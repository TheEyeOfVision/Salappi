import React, { useState } from 'react';
import { 
  ShoppingCart, Wallet, Shield, Package, CheckCircle, 
  Clock, User, AlertTriangle, TrendingUp, Truck, Store, 
  Gavel, ArrowRightLeft, XCircle, LayoutDashboard 
} from 'lucide-react';

// --- DOMAIN LOGIC: STATE MACHINE ---
class EscrowStateMachine {
  constructor(orderId, buyerId, sellerId, amount, productType) {
    this.orderId = orderId;
    this.buyerId = buyerId;
    this.sellerId = sellerId;
    this.amount = amount;
    this.productType = productType;
    this.state = {
      OrderCreated: false,
      PaymentInitiated: false,
      WalletAuth: false,
      BuyerBalanceOK: false,
      FundsDeducted: false,
      EscrowHeld: false,
      SellerNotified: false,
      OrderFulfilled: false,
      BuyerConfirmed: false,
      FundsReleased: false,
      SellerCredited: false,
      TransactionComplete: false,
      Failed: false,
      Disputed: false,         // New State
      DisputeResolved: false   // New State
    };
    this.history = [];
    this.currentStage = 'Product Selection';
    this.metadata = {
      walletProvider: null,
      trackingNumber: null,
      disputeReason: null,     // New Metadata
      resolutionDecision: null // New Metadata
    };
  }

  recordState(stage) {
    this.history.push({
      timestamp: Date.now(),
      stage,
      propositions: { ...this.state }
    });
  }

  async createOrder() {
    this.state.OrderCreated = true;
    this.currentStage = 'Order Created';
    this.recordState(this.currentStage);
    return { success: true };
  }

  async initiatePayment(walletProvider) {
    this.state.PaymentInitiated = true;
    this.metadata.walletProvider = walletProvider;
    this.currentStage = 'Payment Initiated';
    this.recordState(this.currentStage);
    return { success: true };
  }

  async authorizeWallet(wallets) {
    const buyerWallet = wallets[this.buyerId];
    if (buyerWallet.balance >= this.amount) {
      this.state.BuyerBalanceOK = true;
      this.state.WalletAuth = true;
      this.currentStage = 'Wallet Authorized';
      this.recordState(this.currentStage);
      return { success: true };
    }
    this.state.Failed = true;
    return { success: false, error: 'Insufficient funds' };
  }

  async deductAndEscrow(wallets) {
    wallets[this.buyerId].balance -= this.amount;
    wallets.ESCROW.balance += this.amount;
    this.state.FundsDeducted = true;
    this.state.EscrowHeld = true;
    this.currentStage = 'Funds Secured in Vault';
    this.recordState(this.currentStage);
    return { success: true };
  }

  async notifySeller() {
    this.state.SellerNotified = true;
    this.currentStage = 'Awaiting Shipment';
    this.recordState(this.currentStage);
    return { success: true };
  }

  async fulfillOrder(trackingNumber) {
    this.state.OrderFulfilled = true;
    this.metadata.trackingNumber = trackingNumber;
    this.currentStage = 'Item Shipped';
    this.recordState(this.currentStage);
    return { success: true };
  }

  // --- NEW: Dispute Logic ---
  async raiseDispute(reason) {
    if (!this.state.OrderFulfilled) return { success: false, error: "Cannot dispute before shipping" };
    this.state.Disputed = true;
    this.metadata.disputeReason = reason;
    this.currentStage = '❌ DISPUTE RAISED';
    this.recordState(this.currentStage);
    return { success: true };
  }

  async resolveDispute(decision, wallets) {
    // decision: 'REFUND_BUYER' or 'PAY_SELLER'
    this.state.Disputed = false;
    this.state.DisputeResolved = true;
    this.metadata.resolutionDecision = decision;

    if (decision === 'REFUND_BUYER') {
        wallets.ESCROW.balance -= this.amount;
        wallets[this.buyerId].balance += this.amount;
        this.state.FundsReleased = true; // Technically released back to buyer
        this.state.TransactionComplete = true; // Ended
        this.currentStage = 'Refunded to Buyer';
    } else {
        // Force complete
        wallets.ESCROW.balance -= this.amount;
        wallets[this.sellerId].balance += this.amount;
        this.state.FundsReleased = true;
        this.state.SellerCredited = true;
        this.state.TransactionComplete = true;
        this.currentStage = 'Dispute Resolved: Seller Paid';
    }
    this.recordState(this.currentStage);
    return { success: true };
  }

  async confirmReceipt() {
    if (this.state.Disputed) return { success: false, error: "Cannot confirm while disputed" };
    this.state.BuyerConfirmed = true;
    this.currentStage = 'Receipt Confirmed';
    this.recordState(this.currentStage);
    return { success: true };
  }

  async releaseEscrow(wallets) {
    wallets.ESCROW.balance -= this.amount;
    this.state.FundsReleased = true;
    return { success: true };
  }

  async creditSeller(wallets) {
    wallets[this.sellerId].balance += this.amount;
    this.state.SellerCredited = true;
    this.state.TransactionComplete = true;
    this.currentStage = 'Transaction Complete';
    this.recordState(this.currentStage);
    return { success: true };
  }
}

class EscrowProcessor {
  constructor() {
    this.wallets = {
      'BUYER_001': { balance: 5000, name: 'Juan Dela Cruz', provider: 'GCash' },
      'BUYER_002': { balance: 3000, name: 'Maria Santos', provider: 'Maya' },
      'SELLER_001': { balance: 1000, name: 'Tech Store PH', provider: 'GCash' },
      'ESCROW': { balance: 0, name: 'Platform Escrow Vault' }
    };
    this.orders = [];
    this.products = [
      { id: 'P1', name: 'Gaming Laptop', price: 2500, seller: 'SELLER_001', type: 'goods' },
      { id: 'P2', name: 'Smartphone', price: 1500, seller: 'SELLER_001', type: 'goods' },
    ];
  }

  async processEscrowOrder(buyerId, productId) {
    const product = this.products.find(p => p.id === productId);
    const orderId = `ORD-${Math.floor(Math.random() * 10000)}`;
    const escrow = new EscrowStateMachine(orderId, buyerId, product.seller, product.price, product.type);
    
    await escrow.createOrder();
    await escrow.initiatePayment(this.wallets[buyerId].provider);
    const auth = await escrow.authorizeWallet(this.wallets);
    if (!auth.success) return auth;
    
    await escrow.deductAndEscrow(this.wallets);
    await escrow.notifySeller();
    
    this.orders.push(escrow);
    return { success: true, escrow };
  }

  getWallets() { return { ...this.wallets }; }
  getProducts() { return [...this.products]; }
  getOrders() { return [...this.orders]; }
}

export default function EscrowWalletApp() {
  const [processor] = useState(() => new EscrowProcessor());
  const [wallets, setWallets] = useState(processor.getWallets());
  const [products] = useState(processor.getProducts());
  const [orders, setOrders] = useState([]);
  const [selectedBuyer, setSelectedBuyer] = useState('BUYER_001');
  const [view, setView] = useState('buyer'); // 'buyer', 'seller', 'admin'
  const [processing, setProcessing] = useState(false);

  const handlePurchase = async (productId) => {
    setProcessing(true);
    const result = await processor.processEscrowOrder(selectedBuyer, productId);
    if (result.success) {
      setOrders(processor.getOrders());
      setWallets(processor.getWallets());
    }
    setProcessing(false);
  };

  const handleFulfill = async (orderId) => {
    const order = processor.getOrders().find(o => o.orderId === orderId);
    await order.fulfillOrder(`TRK-${Math.floor(Math.random() * 999999)}`);
    setOrders(processor.getOrders());
  };

  const handleDispute = async (orderId) => {
    const order = processor.getOrders().find(o => o.orderId === orderId);
    const reason = prompt("What is the issue? (e.g., Damaged item, Wrong color)");
    if(reason) {
        await order.raiseDispute(reason);
        setOrders(processor.getOrders());
    }
  };

  const handleResolve = async (orderId, decision) => {
      const order = processor.getOrders().find(o => o.orderId === orderId);
      await order.resolveDispute(decision, processor.wallets);
      setOrders(processor.getOrders());
      setWallets(processor.getWallets());
  };

  const handleConfirmAndRelease = async (orderId) => {
    const order = processor.getOrders().find(o => o.orderId === orderId);
    await order.confirmReceipt();
    await order.releaseEscrow(processor.wallets);
    await order.creditSeller(processor.wallets);
    setOrders(processor.getOrders());
    setWallets(processor.getWallets());
  };

  // --- UI COMPONENTS ---
  
  const StatusBadge = ({ stage, isDisputed }) => {
    if (isDisputed) return <span className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-bold border border-red-200 flex items-center gap-1"><AlertTriangle size={12}/> DISPUTED</span>;
    if (stage === 'Transaction Complete') return <span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-bold border border-green-200 flex items-center gap-1"><CheckCircle size={12}/> COMPLETE</span>;
    if (stage === 'Item Shipped') return <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 flex items-center gap-1"><Truck size={12}/> SHIPPED</span>;
    return <span className="px-2 py-1 rounded bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200 flex items-center gap-1"><Shield size={12}/> {stage}</span>;
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-gray-900 overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-2xl z-10">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 text-purple-400">
            <Shield size={28} />
            <span className="text-xl font-bold tracking-tight">TrustVault</span>
          </div>
          <p className="text-slate-500 text-xs mt-2">BSP Regulated Escrow</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setView('buyer')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'buyer' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' : 'text-slate-400 hover:bg-slate-800'}`}>
            <User size={20} />
            <div className="text-left">
              <div className="font-semibold">Buyer Portal</div>
              <div className="text-[10px] opacity-70">Purchase & Inspect</div>
            </div>
          </button>

          <button onClick={() => setView('seller')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'seller' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Store size={20} />
            <div className="text-left">
              <div className="font-semibold">Seller Portal</div>
              <div className="text-[10px] opacity-70">Fulfill & Earn</div>
            </div>
          </button>

          <button onClick={() => setView('admin')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'admin' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/50' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Gavel size={20} />
            <div className="text-left">
              <div className="font-semibold">Admin Panel</div>
              <div className="text-[10px] opacity-70">Resolve Disputes</div>
            </div>
            {orders.some(o => o.state.Disputed) && <div className="ml-auto w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>}
          </button>
        </nav>

        <div className="p-6 bg-slate-950">
           <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-bold">Escrow Vault Balance</div>
           <div className="text-2xl font-mono text-emerald-400 font-bold">₱ {wallets.ESCROW.balance.toLocaleString()}</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        <header className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800">
                {view === 'buyer' && "Marketplace & Orders"}
                {view === 'seller' && "Merchant Dashboard"}
                {view === 'admin' && "Dispute Resolution Center"}
            </h1>
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border text-sm text-slate-600">
                <Clock size={16}/>
                <span>System Live</span>
            </div>
        </header>

        {/* --- BUYER VIEW --- */}
        {view === 'buyer' && (
            <div className="space-y-6">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map(p => (
                        <div key={p.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                    <Package size={24}/>
                                </div>
                                <span className="font-mono font-bold text-slate-700">₱{p.price.toLocaleString()}</span>
                            </div>
                            <h3 className="font-bold text-lg text-slate-800">{p.name}</h3>
                            <p className="text-sm text-slate-500 mb-6">Sold by {wallets[p.seller].name}</p>
                            <button 
                                onClick={() => handlePurchase(p.id)}
                                disabled={processing || wallets[selectedBuyer].balance < p.price}
                                className="w-full py-3 rounded-xl font-bold bg-slate-900 text-white hover:bg-purple-600 transition-colors disabled:bg-slate-300"
                            >
                                {processing ? 'Processing...' : 'Secure Purchase'}
                            </button>
                        </div>
                    ))}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700">My Orders</div>
                    {orders.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">No active orders</div>
                    ) : (
                        orders.map(o => (
                            <div key={o.orderId} className="p-6 border-b last:border-0 flex items-center justify-between hover:bg-slate-50">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-xs text-slate-400">#{o.orderId}</span>
                                        <StatusBadge stage={o.currentStage} isDisputed={o.state.Disputed} />
                                    </div>
                                    <div className="font-bold text-slate-800">Purchased from {wallets[o.sellerId].name}</div>
                                </div>
                                <div className="flex gap-2">
                                    {o.state.OrderFulfilled && !o.state.TransactionComplete && !o.state.Disputed && (
                                        <>
                                            <button onClick={() => handleDispute(o.orderId)} className="px-4 py-2 rounded-lg border border-red-200 text-red-600 font-bold text-sm hover:bg-red-50 flex items-center gap-2">
                                                <AlertTriangle size={16}/> Report Issue
                                            </button>
                                            <button onClick={() => handleConfirmAndRelease(o.orderId)} className="px-4 py-2 rounded-lg bg-green-600 text-white font-bold text-sm hover:bg-green-700 shadow-lg shadow-green-200 flex items-center gap-2">
                                                <CheckCircle size={16}/> Confirm Received
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        )}

        {/* --- SELLER VIEW --- */}
        {view === 'seller' && (
            <div className="space-y-6">
                <div className="grid grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="text-sm text-slate-500 mb-1">My Wallet Balance</div>
                        <div className="text-3xl font-bold text-slate-800">₱ {wallets['SELLER_001'].balance.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="text-sm text-slate-500 mb-1">Pending in Escrow</div>
                        <div className="text-3xl font-bold text-purple-600">
                            ₱ {orders.filter(o => !o.state.TransactionComplete && !o.state.Failed).reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700">Orders to Fulfill</div>
                    {orders.filter(o => o.sellerId === 'SELLER_001').map(o => (
                        <div key={o.orderId} className={`p-6 border-b last:border-0 flex items-center justify-between ${o.state.Disputed ? 'bg-red-50' : ''}`}>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-xs text-slate-400">#{o.orderId}</span>
                                    <StatusBadge stage={o.currentStage} isDisputed={o.state.Disputed} />
                                </div>
                                <div className="font-bold text-slate-800">Item: Gaming Laptop</div>
                                {o.state.Disputed && (
                                    <div className="text-xs text-red-600 font-bold mt-2 flex items-center gap-1">
                                        <AlertTriangle size={12}/> FUNDS FROZEN: Buyer reported "{o.metadata.disputeReason}"
                                    </div>
                                )}
                            </div>
                            
                            {o.state.EscrowHeld && !o.state.OrderFulfilled && (
                                <button onClick={() => handleFulfill(o.orderId)} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2">
                                    <Truck size={18}/> Ship Order
                                </button>
                            )}
                            
                            {o.state.OrderFulfilled && !o.state.TransactionComplete && !o.state.Disputed && (
                                <div className="text-xs text-slate-400 italic">Waiting for buyer confirmation...</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* --- ADMIN VIEW --- */}
        {view === 'admin' && (
            <div className="space-y-6">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="text-amber-600 mt-1" />
                    <div>
                        <h3 className="font-bold text-amber-800">Admin Responsibility</h3>
                        <p className="text-sm text-amber-700">As the trusted third party, you have the power to override transaction locks. Only use this power when a dispute is raised.</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700 flex justify-between">
                        <span>Active Disputes</span>
                        <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-xs">
                            {orders.filter(o => o.state.Disputed).length} Action Required
                        </span>
                    </div>
                    
                    {orders.filter(o => o.state.Disputed).length === 0 ? (
                        <div className="p-12 text-center">
                            <CheckCircle size={48} className="mx-auto text-green-200 mb-4"/>
                            <div className="text-slate-400">All systems nominal. No active disputes.</div>
                        </div>
                    ) : (
                        orders.filter(o => o.state.Disputed).map(o => (
                            <div key={o.orderId} className="p-6 border-b last:border-0">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="font-mono text-xs text-slate-400">CASE #{o.orderId}</div>
                                        <div className="font-bold text-lg text-slate-800">Dispute Reason: "{o.metadata.disputeReason}"</div>
                                        <div className="text-sm text-slate-500 mt-1">
                                            Amount held in vault: <span className="text-purple-600 font-bold">₱{o.amount.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                         <button onClick={() => handleResolve(o.orderId, 'REFUND_BUYER')} className="px-4 py-2 border border-red-200 bg-red-50 text-red-700 rounded-lg font-bold text-sm hover:bg-red-100 flex items-center gap-2">
                                            <ArrowRightLeft size={16}/> Refund Buyer
                                        </button>
                                        <button onClick={() => handleResolve(o.orderId, 'PAY_SELLER')} className="px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg font-bold text-sm hover:bg-blue-100 flex items-center gap-2">
                                            <CheckCircle size={16}/> Release to Seller
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600">
                                    <strong>Audit Trail:</strong>
                                    <div className="mt-2 space-y-1 font-mono text-xs">
                                        {o.history.map((h, i) => (
                                            <div key={i} className="flex gap-2">
                                                <span className="text-slate-400">{new Date(h.timestamp).toLocaleTimeString()}</span>
                                                <span>{h.stage}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        )}

      </main>
    </div>
  );
}