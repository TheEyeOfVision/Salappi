import React, { useState, useContext, createContext, useEffect } from 'react';
import { 
  Briefcase, LogOut, Users, DollarSign, Bell, Trash2, 
  TrendingUp, Plus, Edit, CheckCircle, X, Copy, Share2,Info
} from 'lucide-react';

/* =========================
   CONSTANTS (From your context)
========================= */
const COMMISSION_LEVELS = [0.05, 0.03, 0.02, 0.01, 0.01];

/* =========================
   TYPES (From your context)
========================= */
interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'provider' | 'customer';
  balance: number;
  referralCode: string;
  uplineId: string | null;
  downlineIds: string[];
  totalEarnings: number;
  createdAt: number;
}

interface Service {
  id: string;
  providerId: string;
  title: string;
  description: string;
  category: string;
  price: number;
  status: 'active' | 'inactive';
  createdAt: number;
}

interface Commission {
  referrerId: string;
  referrerName: string;
  level: number;
  amount: number;
}

interface Booking {
  id: string;
  serviceId: string;
  customerId: string;
  providerId: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'completed';
  escrowStatus: 'held' | 'released';
  createdAt: number;
  commissions?: Commission[];
}

interface NotificationState {
  msg: string;
  type: 'info' | 'success' | 'error';
}
interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success';
  createdAt: number;
}

interface AuthContextType {
  currentUser: User | null;
  login: (email: string, password: string) => boolean;
  register: (
    userData: Omit<User, 'id' | 'balance' | 'referralCode' | 'createdAt' | 'uplineId' | 'downlineIds' | 'totalEarnings'>,
    referralCode?: string | null
  ) => boolean;
  logout: () => void;
  refreshUser: () => void;
  db: Database;
  showNotification: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

/* =========================
   LOGIC ENGINE (Database Mock)
========================= */
class Database {
  private users: User[] = [];
  private services: Service[] = [];
  private bookings: Booking[] = [];
  private announcements: Announcement[] = []; // <--- Added storage for alerts

  constructor() {
    // =========================
    // 1. SEED USERS (Your Data)
    // =========================
    
    // ADMIN
    this.createUser({
      id: 'ADMIN', email: 'admin@salappi.com', password: '123', name: 'Super Admin',
      role: 'admin', balance: 0, referralCode: 'ADMIN', uplineId: null, downlineIds: [], totalEarnings: 0, createdAt: Date.now()
    });

    // PROVIDER (The Upline)
    this.createUser({
      id: 'UPLINE1', email: 'upline@salappi.com', password: '123', name: 'Top Upline',
      role: 'provider', balance: 500, referralCode: 'TOP1', uplineId: null, downlineIds: ['CUST1'], totalEarnings: 0, createdAt: Date.now()
    });

    // CUSTOMER (The Downline)
    this.createUser({
      id: 'CUST1', 
      email: 'customer@salappi.com', 
      password: '123', 
      name: 'Test Customer',
      role: 'customer', 
      balance: 5000, 
      referralCode: 'CUST-REF', 
      uplineId: 'UPLINE1', 
      downlineIds: [], 
      totalEarnings: 0, 
      createdAt: Date.now()
    });

    // =========================
    // 2. SEED ANNOUNCEMENT
    // =========================
    this.createAnnouncement({
      id: 'ANN-INIT',
      title: 'System Online',
      content: 'Salappi Platform initialized. 5-Level Commission Structure is ACTIVE.',
      type: 'success',
      createdAt: Date.now()
    });
  }

  // =========================
  // USER LOGIC
  // =========================
  getUser(id: string) { return this.users.find(u => u.id === id); }
  getUserByEmail(email: string) { return this.users.find(u => u.email === email); }
  getAllUsers() { return [...this.users]; }
  
  createUser(user: User) { 
    this.users.push(user); 
    return user; 
  }

  // Admin: Delete a user
  deleteUser(id: string) {
    this.users = this.users.filter(u => u.id !== id);
  }

  registerUserWithReferral(user: User, refCode: string) {
    const upline = this.users.find(u => u.referralCode === refCode);
    if (upline) {
      user.uplineId = upline.id;
      upline.downlineIds.push(user.id);
    }
    this.users.push(user);
    return user;
  }

  // =========================
  // ANNOUNCEMENT LOGIC (New)
  // =========================
  getAllAnnouncements() { 
    // Return sorted by newest first so the top alerts are fresh
    return [...this.announcements].sort((a, b) => b.createdAt - a.createdAt); 
  }
  
  createAnnouncement(a: Announcement) { 
    this.announcements.push(a); 
  }
  
  deleteAnnouncement(id: string) { 
    this.announcements = this.announcements.filter(a => a.id !== id); 
  }

  // =========================
  // SERVICE & BOOKING LOGIC
  // =========================
  createBooking(b: Booking) { this.bookings.push(b); }
  
  // Provider View
  getBookingsByProvider(id: string) { return this.bookings.filter(b => b.providerId === id); }
  
  // Admin View
  getAllBookings() { return [...this.bookings]; }

  getAllServices() { return [...this.services]; }
  createService(s: Service) { this.services.push(s); }
  getServicesByProvider(id: string) { return this.services.filter(s => s.providerId === id); }
  
  // Admin Helper
  getService(id: string) { return this.services.find(s => s.id === id); }
  deleteService(id: string) { this.services = this.services.filter(s => s.id !== id); }

  // =========================
  // THE MLM ENGINE
  // =========================
  completeBooking(bookingId: string) {
    const booking = this.bookings.find(b => b.id === bookingId);
    if (!booking || booking.status === 'completed') return;

    const provider = this.users.find(u => u.id === booking.providerId);
    if (!provider) return;

    // 1. Release payment to Provider
    provider.balance += booking.amount;
    booking.status = 'completed';
    booking.escrowStatus = 'released';
    booking.commissions = [];

    // 2. Distribute Commissions recursively (5 Levels)
    let currentUplineId = provider.uplineId;
    
    COMMISSION_LEVELS.forEach((percentage, index) => {
      if (!currentUplineId) return;

      const uplineUser = this.users.find(u => u.id === currentUplineId);
      if (uplineUser) {
        const commAmount = booking.amount * percentage;
        uplineUser.balance += commAmount;
        uplineUser.totalEarnings += commAmount;

        booking.commissions?.push({
          referrerId: uplineUser.id,
          referrerName: uplineUser.name,
          level: index + 1,
          amount: commAmount
        });

        currentUplineId = uplineUser.uplineId; // Move up the tree
      }
    });
  }
}

// --- Context Setup ---
const AuthContext = createContext<AuthContextType | null>(null);
const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

/* =========================
   UI COMPONENTS (Boxy Design System)
========================= */

const Box = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 ${className}`}>
    {children}
  </div>
);

const Button = ({ onClick, children, variant = "primary", className = "" }: any) => {
  const base = "px-6 py-3 font-bold uppercase tracking-widest border-2 border-black transition-all active:translate-y-1 active:shadow-none select-none";
  const styles = {
    primary: "bg-black text-white shadow-[4px_4px_0px_0px_rgba(100,100,100,1)] hover:bg-gray-800",
    secondary: "bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50",
    success: "bg-green-600 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-green-700",
  };
  return (
    <button onClick={onClick} className={`${base} ${styles[variant as keyof typeof styles]} ${className}`}>
      {children}
    </button>
  );
};

const Input = (props: any) => (
  <input {...props} className={`w-full p-3 border-2 border-black rounded-none focus:outline-none focus:bg-yellow-50 placeholder:text-gray-400 font-mono ${props.className}`} />
);

/* =========================
   MAIN APP
========================= */

export default function SalappiPlatform() {
  const [db] = useState(() => new Database());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const showNotification = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const refreshUser = () => {
    if (currentUser) {
      const updated = db.getUser(currentUser.id);
      if (updated) setCurrentUser({ ...updated });
    }
  };

  const login = (e: string, p: string) => {
    const user = db.getUserByEmail(e);
    if (user && user.password === p) {
      setCurrentUser(user);
      return true;
    }
    showNotification('Invalid Credentials', 'error');
    return false;
  };

  const register = (data: any, refCode: string | null = null) => {
    if (db.getUserByEmail(data.email)) {
      showNotification('Email exists', 'error');
      return false;
    }
    const newUser: User = {
      id: `USR${Date.now()}`,
      ...data,
      balance: 2000, 
      referralCode: `REF-${Math.floor(Math.random() * 10000)}`,
      createdAt: Date.now(),
      uplineId: null,
      downlineIds: [],
      totalEarnings: 0
    };

    const user = refCode ? db.registerUserWithReferral(newUser, refCode) : db.createUser(newUser);
    setCurrentUser(user);
    showNotification('Account created', 'success');
    return true;
  };

  const logout = () => setCurrentUser(null);

  return (
    <AuthContext.Provider value={{ currentUser, login, register, logout, refreshUser, db, showNotification }}>
      <div className="min-h-screen bg-stone-100 font-sans text-black selection:bg-yellow-200">
        
        {/* Notification Toast - Fixed Logic & Boxy Styling */}
        {notification && (
          <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-4 duration-300">
             <div className={`border-4 border-black p-4 font-black flex items-center gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${
               notification.type === 'error' ? 'bg-red-400' : 
               notification.type === 'success' ? 'bg-green-400' : 'bg-yellow-300'
             }`}>
                {notification.type === 'error' ? <X size={20} strokeWidth={3}/> : <Info size={20} strokeWidth={3}/>}
                <span className="uppercase tracking-tight">{notification.msg}</span>
             </div>
          </div>
        )}

        {!currentUser ? (
          <LoginPage />
        ) : (
          <div className="max-w-6xl mx-auto p-4 md:p-8">
            {/* Unified Header */}
            <header className="mb-8 flex justify-between items-end border-b-4 border-black pb-4">
              <div>
                <h1 className="text-4xl font-black uppercase italic tracking-tighter">Salappi</h1>
                <div className="flex gap-2 mt-1">
                  <div className="font-mono text-[10px] bg-black text-white px-2 py-0.5">
                    {currentUser.name}
                  </div>
                  <div className="font-mono text-[10px] bg-yellow-400 border border-black px-2 py-0.5 font-bold uppercase">
                    {currentUser.role}
                  </div>
                </div>
              </div>
              <Button 
                variant="secondary" 
                onClick={logout} 
                className="py-1 px-4 text-[10px] font-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                LOGOUT
              </Button>
            </header>

            {/* Role-Based Routing */}
            <main className="animate-in fade-in duration-700">
              {currentUser.role === 'provider' && <ProviderDashboard />}
              {currentUser.role === 'customer' && <CustomerDashboard />}
              {currentUser.role === 'admin' && <AdminDashboard />}
            </main>
          </div>
        )}
      </div>
    </AuthContext.Provider>
  );
}

/* =========================
   PAGES
========================= */

function LoginPage() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'customer' as 'customer' | 'provider', referralCode: '' });

  const submit = () => {
    isLogin 
      ? login(form.email, form.password)
      : register({ email: form.email, password: form.password, name: form.name, role: form.role }, form.referralCode || null);
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-stone-100">
      <div className="w-full max-w-sm bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-10 flex flex-col">
        <div className="text-center mb-10">
          <Briefcase className="mx-auto mb-4 w-12 h-12" />
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">Salappi</h1>
          <p className="text-gray-500 text-sm mt-2">{isLogin ? 'Access Portal' : 'Initialize Account'}</p>
        </div>

        <div className="space-y-4 mb-8">
          {!isLogin && (
            <>
              <Input placeholder="FULL NAME" onChange={(e:any) => setForm({ ...form, name: e.target.value })} />
              <select className="w-full p-3 border-2 border-black rounded-none focus:outline-none bg-white font-mono" 
                onChange={(e) => setForm({ ...form, role: e.target.value as any })}>
                <option value="customer">CUSTOMER</option>
                <option value="provider">PROVIDER</option>
              </select>
            </>
          )}
          <Input placeholder="EMAIL" onChange={(e:any) => setForm({ ...form, email: e.target.value })} />
          <Input type="password" placeholder="PASSWORD" onChange={(e:any) => setForm({ ...form, password: e.target.value })} />
          {!isLogin && <Input placeholder="REFERRAL CODE (OPTIONAL)" onChange={(e:any) => setForm({ ...form, referralCode: e.target.value })} />}
        </div>

        <Button onClick={submit} className="w-full">{isLogin ? 'ENTER' : 'REGISTER'}</Button>
        <button onClick={() => setIsLogin(!isLogin)} className="w-full mt-4 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-black">
            {isLogin ? '[ Create Account ]' : '[ Back to Login ]'}
        </button>
      </div>
    </div>
  );
}

function ProviderDashboard() {
  const { currentUser, db, refreshUser, showNotification } = useAuth();
  
  // Local state for dashboard navigation
  const [activeTab, setActiveTab] = useState<'ops' | 'network'>('ops');
  
  const [services, setServices] = useState(db.getServicesByProvider(currentUser!.id));
  const [bookings, setBookings] = useState(db.getBookingsByProvider(currentUser!.id));
  const [newSvc, setNewSvc] = useState({ title: '', price: 0, category: 'Tech' });

  const addService = () => {
    db.createService({
      id: `SVC${Date.now()}`, providerId: currentUser!.id, ...newSvc, description: 'Standard service', status: 'active', createdAt: Date.now()
    });
    setServices(db.getServicesByProvider(currentUser!.id));
    showNotification('Service Deployed', 'success');
  };

  const handleComplete = (bId: string) => {
    db.completeBooking(bId);
    setBookings(db.getBookingsByProvider(currentUser!.id));
    refreshUser(); 
    showNotification('Booking Completed & Commissions Paid', 'success');
  };

  return (
    <div className="space-y-8">
      {/* 1. Stats Grid - Always Visible */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Box className="bg-black text-white">
           <h3 className="font-mono text-xs uppercase mb-2 text-gray-400">Total Balance</h3>
           <div className="text-4xl font-black">₱{currentUser!.balance.toLocaleString()}</div>
        </Box>
        <Box>
           <h3 className="font-mono text-xs uppercase mb-2 text-gray-500">Referral Earnings</h3>
           <div className="text-4xl font-black text-green-600">₱{currentUser!.totalEarnings.toLocaleString()}</div>
        </Box>
        <Box className="bg-yellow-400">
           <h3 className="font-mono text-xs uppercase mb-2 text-black/60">Network Status</h3>
           <div className="text-2xl font-black uppercase italic">Active Level 1</div>
        </Box>
      </div>

      {/* 2. Sub-Navigation Tabs */}
      <div className="flex gap-2">
        <button 
          onClick={() => setActiveTab('ops')}
          className={`px-6 py-2 font-black uppercase text-xs tracking-widest border-2 border-black transition-all ${
            activeTab === 'ops' ? 'bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'bg-white hover:bg-gray-100'
          }`}
        >
          Operations
        </button>
        <button 
          onClick={() => setActiveTab('network')}
          className={`px-6 py-2 font-black uppercase text-xs tracking-widest border-2 border-black transition-all ${
            activeTab === 'network' ? 'bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'bg-white hover:bg-gray-100'
          }`}
        >
          Referral Network
        </button>
      </div>

      {/* 3. Conditional Content Rendering */}
      {activeTab === 'ops' ? (
        <div className="grid lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* Left Col: Services */}
          <div className="space-y-6">
            <Box>
              <h2 className="font-bold uppercase border-b-2 border-black pb-2 mb-4">Deploy Service</h2>
              <div className="space-y-3">
                <Input placeholder="TITLE" onChange={(e:any) => setNewSvc({...newSvc, title: e.target.value})} />
                <Input type="number" placeholder="PRICE" onChange={(e:any) => setNewSvc({...newSvc, price: +e.target.value})} />
                <Button onClick={addService} className="w-full text-sm">Create Service</Button>
              </div>
            </Box>

            <div className="space-y-3">
              <h2 className="font-bold uppercase">Active Deployments</h2>
              {services.map((s) => (
                <Box key={s.id} className="py-3 px-4 flex justify-between items-center bg-gray-50 hover:bg-white transition-colors">
                  <span className="font-bold">{s.title}</span>
                  <span className="font-mono">₱{s.price}</span>
                </Box>
              ))}
            </div>
          </div>

          {/* Right Col: Bookings */}
          <div className="space-y-4">
            <h2 className="font-bold uppercase mb-2">Incoming Jobs</h2>
            {bookings.map((b) => (
              <Box key={b.id} className={`flex flex-col gap-3 ${b.status === 'completed' ? 'opacity-60 grayscale' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                     <div className="text-xs font-mono bg-gray-200 px-2 inline-block mb-1">{b.id}</div>
                     <div className="font-bold text-lg">Service ID: {b.serviceId}</div>
                  </div>
                  <div className="text-right">
                     <div className="font-black text-xl">₱{b.amount}</div>
                     <div className={`text-[10px] px-2 py-0.5 border border-black font-bold uppercase ${b.status === 'completed' ? 'bg-green-400' : 'bg-yellow-200'}`}>
                        {b.status}
                     </div>
                  </div>
                </div>
                
                {b.status === 'pending' && (
                  <Button variant="success" onClick={() => handleComplete(b.id)} className="w-full text-sm py-2">
                    Complete & Release Escrow
                  </Button>
                )}
                
                {/* Embedded Commission Breakdown for finished jobs */}
                {b.commissions && b.commissions.length > 0 && (
                  <div className="mt-2 border-t-2 border-dashed border-gray-300 pt-2">
                    <div className="text-[10px] font-black uppercase mb-1 text-gray-500">MLM Distribution:</div>
                    {b.commissions.map((c, i) => (
                      <div key={i} className="flex justify-between text-xs font-mono">
                        <span className="text-gray-600">L{c.level} Pay: {c.referrerName}</span>
                        <span className="font-bold text-green-700">+₱{c.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Box>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
           <ReferralSection />
        </div>
      )}
    </div>
  );
}

function CustomerDashboard() {
  const { currentUser, db, refreshUser, showNotification } = useAuth();
  const [marketplace] = useState(db.getAllServices());

  const book = (s: Service) => {
    if (currentUser!.balance < s.price) return showNotification('Insufficient funds', 'error');
    
    // Deduct immediately (mock)
    currentUser!.balance -= s.price;
    
    db.createBooking({
      id: `BKG${Date.now()}`, serviceId: s.id, customerId: currentUser!.id, providerId: s.providerId,
      amount: s.price, status: 'pending', escrowStatus: 'held', createdAt: Date.now()
    });
    
    refreshUser();
    showNotification('Funds placed in Escrow', 'success');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black uppercase italic">Marketplace</h2>
        <div className="font-mono border-2 border-black px-4 py-2 bg-white shadow-[4px_4px_0px_0px_#000]">
          WALLET: ₱{currentUser!.balance.toLocaleString()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {marketplace.map((s) => (
          <div key={s.id} className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all flex flex-col h-full">
            <div className="p-6 border-b-2 border-black bg-stone-50 flex-grow">
               <h3 className="font-bold text-xl uppercase leading-tight mb-2">{s.title}</h3>
               <p className="text-gray-600 text-sm font-mono">{s.description}</p>
            </div>
            <div className="p-4 flex items-center justify-between bg-white">
               <span className="font-black text-2xl">₱{s.price}</span>
               <button onClick={() => book(s)} className="bg-black text-white px-4 py-2 font-bold uppercase hover:bg-yellow-400 hover:text-black transition-colors text-sm">
                 Book Service
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function AdminDashboard() {
  const { currentUser, logout, db, showNotification } = useAuth();
  const [view, setView] = useState<'announcements' | 'users' | 'services' | 'bookings'>('announcements');
  
  // Local state for UI reactivity
  const [users, setUsers] = useState(db.getAllUsers());
  const [services, setServices] = useState(db.getAllServices());
  const [bookings, setBookings] = useState(db.getAllBookings());
  const [announcements, setAnnouncements] = useState(db.getAllAnnouncements());
  
  const [newAnnouncement, setNewAnnouncement] = useState<Omit<Announcement, 'id' | 'createdAt'>>({ 
    title: '', content: '', type: 'info' 
  });

  const handleCreateAnnouncement = () => {
    if (!newAnnouncement.title || !newAnnouncement.content) {
      showNotification('Please fill all fields', 'error');
      return;
    }
    const announcement: Announcement = {
      id: `ANN${Date.now()}`,
      ...newAnnouncement,
      createdAt: Date.now()
    };
    db.createAnnouncement(announcement);
    setAnnouncements(db.getAllAnnouncements());
    setNewAnnouncement({ title: '', content: '', type: 'info' });
    showNotification('Announcement created', 'success');
  };

  const handleDeleteUser = (id: string) => {
    if (currentUser && id === currentUser.id) {
      showNotification('Cannot delete your own account', 'error');
      return;
    }
    db.deleteUser(id);
    setUsers(db.getAllUsers());
    showNotification('User deleted', 'success');
  };

  const handleDeleteService = (id: string) => {
  db.deleteService(id); // This calls the method we added to your Database class
  setServices(db.getAllServices()); // Refresh local state to update the UI
  showNotification('Service removed from registry', 'success');
};

  if (!currentUser) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Box className="bg-blue-100 border-blue-600">
          <Users className="mb-2 text-blue-600" size={24} />
          <div className="text-3xl font-black">{users.length}</div>
          <div className="text-[10px] uppercase font-bold text-blue-600">Total Users</div>
        </Box>
        <Box className="bg-purple-100 border-purple-600">
          <Briefcase className="mb-2 text-purple-600" size={24} />
          <div className="text-3xl font-black">{services.length}</div>
          <div className="text-[10px] uppercase font-bold text-purple-600">Total Services</div>
        </Box>
        <Box className="bg-green-100 border-green-600">
          <DollarSign className="mb-2 text-green-600" size={24} />
          <div className="text-3xl font-black">{bookings.length}</div>
          <div className="text-[10px] uppercase font-bold text-green-600">Total Bookings</div>
        </Box>
        <Box className="bg-orange-100 border-orange-600">
          <Bell className="mb-2 text-orange-600" size={24} />
          <div className="text-3xl font-black">{announcements.length}</div>
          <div className="text-[10px] uppercase font-bold text-orange-600">Alerts</div>
        </Box>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b-4 border-black pb-4">
        {['announcements', 'users', 'services', 'bookings'].map((tab) => (
          <button
            key={tab}
            onClick={() => setView(tab as any)}
            className={`px-4 py-2 font-black uppercase text-xs tracking-tighter border-2 border-black transition-all ${
              view === tab ? 'bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'bg-white hover:bg-stone-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* View Content */}
      <div className="grid gap-6">
        {view === 'announcements' && (
          <div className="grid md:grid-cols-2 gap-8">
            <Box>
              <h2 className="font-black uppercase mb-4 border-b-2 border-black pb-2">Broadcast Message</h2>
              <div className="space-y-4">
                <Input 
                  placeholder="TITLE" 
                  value={newAnnouncement.title}
                  onChange={(e:any) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                />
                <textarea
                  placeholder="CONTENT"
                  className="w-full p-3 border-2 border-black focus:outline-none focus:bg-yellow-50 font-mono text-sm h-32"
                  value={newAnnouncement.content}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                />
                <select 
                  className="w-full p-3 border-2 border-black font-bold uppercase text-xs"
                  value={newAnnouncement.type}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, type: e.target.value as any })}
                >
                  <option value="info">INFO (BLUE)</option>
                  <option value="warning">WARNING (YELLOW)</option>
                  <option value="success">SUCCESS (GREEN)</option>
                </select>
                <Button onClick={handleCreateAnnouncement} className="w-full">Post Announcement</Button>
              </div>
            </Box>

            <div className="space-y-4">
              <h2 className="font-black uppercase">Live Feed</h2>
              {announcements.map(ann => (
                <Box key={ann.id} className={`relative ${ann.type === 'warning' ? 'bg-yellow-50' : 'bg-white'}`}>
                  <button 
                    onClick={() => { 
  db.deleteAnnouncement(ann.id); 
  setAnnouncements(db.getAllAnnouncements()); 
}}
                    className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="text-[10px] font-mono text-gray-400 mb-1">{new Date(ann.createdAt).toLocaleDateString()}</div>
                  <h3 className="font-bold uppercase tracking-tight">{ann.title}</h3>
                  <p className="text-sm font-mono mt-2">{ann.content}</p>
                </Box>
              ))}
            </div>
          </div>
        )}

        {view === 'users' && (
          <div className="grid gap-4">
            <h2 className="font-black uppercase">User Registry</h2>
            {users.map(user => (
              <Box key={user.id} className="flex justify-between items-center py-4">
                <div>
                  <div className="font-black uppercase">{user.name} <span className="text-[10px] font-mono font-normal ml-2 text-gray-500">ID: {user.id}</span></div>
                  <div className="text-sm font-mono text-gray-600">{user.email} | {user.role}</div>
                  <div className="text-xs font-bold text-green-700 mt-1">WALLET: ₱{user.balance.toLocaleString()}</div>
                </div>
                {user.id !== currentUser.id && (
                  <button onClick={() => handleDeleteUser(user.id)} className="bg-red-100 p-2 border-2 border-red-600 hover:bg-red-600 hover:text-white transition-colors">
                    <Trash2 size={18} />
                  </button>
                )}
              </Box>
            ))}
          </div>
        )}

        {/* View: Services */}
{view === 'services' && (
  <div className="grid gap-4">
    <h2 className="font-black uppercase">Global Service Registry</h2>
    <div className="grid md:grid-cols-2 gap-4">
      {services.map(service => (
        <Box key={service.id} className="flex flex-col justify-between hover:bg-stone-50 transition-colors">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-mono bg-black text-white px-2 py-0.5 uppercase">
                {service.category}
              </span>
              <button 
                onClick={() => handleDeleteService(service.id)}
                className="text-red-600 hover:scale-110 transition-transform"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <h3 className="font-black text-lg uppercase tracking-tighter">{service.title}</h3>
            <p className="text-sm font-mono text-gray-600 mt-1 mb-4">{service.description}</p>
          </div>
          <div className="border-t-2 border-black pt-3 flex justify-between items-center">
            <span className="font-mono text-xs">Provider: {db.getUser(service.providerId)?.name}</span>
            <span className="font-black text-xl">₱{service.price.toLocaleString()}</span>
          </div>
        </Box>
      ))}
    </div>
    {services.length === 0 && <div className="font-mono text-gray-500">No services deployed.</div>}
  </div>
)}

{/* View: Bookings */}
{view === 'bookings' && (
  <div className="grid gap-4">
    <h2 className="font-black uppercase tracking-tight">System Transaction Ledger</h2>
    {bookings.map(booking => {
      const service = db.getService(booking.serviceId);
      const customer = db.getUser(booking.customerId);
      const provider = db.getUser(booking.providerId);

      return (
        <Box key={booking.id} className="border-l-8 border-l-black">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-[10px] bg-gray-200 px-2">{booking.id}</span>
                <span className={`text-[10px] font-black px-2 py-0.5 uppercase border border-black ${
                  booking.status === 'completed' ? 'bg-green-400' : 'bg-yellow-300'
                }`}>
                  {booking.status}
                </span>
              </div>
              <h4 className="font-black text-lg uppercase italic">{service?.title || 'Unknown Service'}</h4>
              <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-xs text-gray-600">
                <div>CLIENT: <span className="text-black font-bold">{customer?.name}</span></div>
                <div>VENDOR: <span className="text-black font-bold">{provider?.name}</span></div>
              </div>
            </div>

            <div className="text-right flex flex-col justify-center border-t-2 md:border-t-0 md:border-l-2 border-black border-dashed pt-4 md:pt-0 md:pl-6">
              <div className="text-[10px] font-black text-gray-400 uppercase">Gross Amount</div>
              <div className="text-2xl font-black">₱{booking.amount.toLocaleString()}</div>
              {booking.escrowStatus === 'held' && (
                <div className="text-[9px] font-bold text-orange-600 uppercase flex items-center justify-end gap-1">
                   Escrow Locked <TrendingUp size={10} />
                </div>
              )}
            </div>
          </div>
          
          {/* Audit trail for MLM payments */}
          {booking.commissions && booking.commissions.length > 0 && (
            <div className="mt-4 bg-stone-100 p-3 border-2 border-black border-dashed">
              <p className="text-[10px] font-black uppercase mb-2">MLM Commission Audit Trail:</p>
              <div className="space-y-1">
                {booking.commissions.map((c, i) => (
                  <div key={i} className="flex justify-between font-mono text-[11px]">
                    <span>Level {c.level} Pay ({c.referrerName})</span>
                    <span className="font-bold">₱{c.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Box>
      );
    })}
  </div>
)}

        
      </div>
    </div>
  );
}

/* =========================
   REFERRALS
========================= */

function ReferralSection() {
  const { currentUser, db, showNotification } = useAuth();
  if (!currentUser) return null;

  const copy = () => {
    navigator.clipboard?.writeText(currentUser.referralCode)
      .then(() => showNotification('Referral code copied', 'success'))
      .catch(() => showNotification('Copy failed', 'error'));
  };

  return (
    <div className="border p-4 rounded">
      <h3 className="font-bold mb-2">Your Referral Code</h3>

      <div className="flex gap-2 items-center mb-4">
        <code className="bg-gray-100 px-2 py-1 rounded">{currentUser.referralCode}</code>
        <button onClick={copy}><Copy size={16} /></button>
      </div>

      <h4 className="font-semibold mb-2">Commission Structure</h4>

      {COMMISSION_LEVELS.map((rate, i) => (
        <div key={i} className="flex justify-between bg-gray-50 p-2 rounded mb-1">
          <span>Level {i + 1}</span>
          <span className="font-bold text-purple-600">{rate * 100}%</span>
        </div>
      ))}

      <div className="mt-4 text-sm text-gray-600">
        Total Earnings: ₱{currentUser.totalEarnings.toFixed(2)}
      </div>
    </div>
  );
}
