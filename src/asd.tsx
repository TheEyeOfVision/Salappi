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

interface Referral {
  userId: string;
  referrerId: string;
  createdAt: number;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success';
  createdAt: number;
}

interface NotificationState {
  msg: string;
  type: 'info' | 'success' | 'error';
}

interface AuthContextType {
  currentUser: User | null;
  login: (email: string, password: string) => boolean;
  register: (
    userData: Omit<User, 'id' | 'balance' | 'referralCode' | 'createdAt' | 'uplineId' | 'downlineIds' | 'totalEarnings'>,
    referralCode?: string | null
  ) => boolean;
  logout: () => void;
  db: Database;
  showNotification: (msg: string, type?: 'info' | 'success' | 'error') => void;
  refreshUser: () => void;
}

/* =======================
   DATABASE
======================= */

class Database {
  users = new Map<string, User>();
  services = new Map<string, Service>();
  bookings = new Map<string, Booking>();
  referrals = new Map<string, Referral>();
  announcements: Announcement[] = [];

  constructor() {
    this.seed();
  }

  seed() {
    const adminId = 'USR_ADMIN';
    const providerId = 'USR_PROVIDER';
    const customerId = 'USR_CUSTOMER';

    this.createUser({
      id: adminId,
      email: 'admin@salappi.com',
      password: 'admin123',
      name: 'Platform Admin',
      role: 'admin',
      balance: 0,
      referralCode: this.generateReferralCode(adminId),
      uplineId: null,
      downlineIds: [],
      totalEarnings: 0,
      createdAt: Date.now()
    });

    this.createUser({
      id: providerId,
      email: 'provider@salappi.com',
      password: 'provider123',
      name: 'Juan Santos',
      role: 'provider',
      balance: 10000,
      referralCode: this.generateReferralCode(providerId),
      uplineId: null,
      downlineIds: [],
      totalEarnings: 0,
      createdAt: Date.now()
    });

    this.createUser({
      id: customerId,
      email: 'customer@salappi.com',
      password: 'customer123',
      name: 'Maria Cruz',
      role: 'customer',
      balance: 50000,
      referralCode: this.generateReferralCode(customerId),
      uplineId: null,
      downlineIds: [],
      totalEarnings: 0,
      createdAt: Date.now()
    });

    this.createService({
      id: 'SVC001',
      providerId,
      title: 'Full-Stack Web Development',
      description: 'React + Node.js development',
      category: 'Technology',
      price: 25000,
      status: 'active',
      createdAt: Date.now()
    });

    this.announcements.push({
      id: 'ANN001',
      title: 'Welcome to Salappi',
      content: 'Browse services or refer friends to earn.',
      type: 'info',
      createdAt: Date.now()
    });
  }

  generateReferralCode(userId: string) {
    return `REF-${userId}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  createUser(user: User) {
    this.users.set(user.id, user);
    return user;
  }

  getUser(id: string) {
    return this.users.get(id);
  }

  getUserByEmail(email: string) {
    return [...this.users.values()].find(u => u.email === email);
  }

  registerUserWithReferral(user: User, referralCode: string) {
    const referrer = [...this.users.values()].find(u => u.referralCode === referralCode);

    if (referrer && referrer.id !== user.id) {
      user.uplineId = referrer.id;
      referrer.downlineIds.push(user.id);

      this.referrals.set(user.id, {
        userId: user.id,
        referrerId: referrer.id,
        createdAt: Date.now()
      });
    }

    this.users.set(user.id, user);
    return user;
  }

  getUplineChain(userId: string, depth = 5): string[] {
    const chain: string[] = [];
    let current = this.users.get(userId);

    while (current?.uplineId && chain.length < depth) {
      chain.push(current.uplineId);
      current = this.users.get(current.uplineId);
    }

    return chain;
  }

  distributeCommissions(amount: number, userId: string): Commission[] {
    const rates = [0.05, 0.03, 0.02, 0.01, 0.01];
    const uplines = this.getUplineChain(userId);
    const commissions: Commission[] = [];

    uplines.forEach((id, i) => {
      const ref = this.users.get(id);
      if (!ref || !rates[i]) return;

      const value = amount * rates[i];
      ref.balance += value;
      ref.totalEarnings += value;

      commissions.push({
        referrerId: id,
        referrerName: ref.name,
        level: i + 1,
        amount: value
      });
    });

    return commissions;
  }
}

/* =======================
   AUTH CONTEXT
======================= */

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}

/* =======================
   APP
======================= */

export default function SalappiPlatform() {
  const [db] = useState(() => new Database());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const refreshUser = () => {
    if (!currentUser) return;
    const updated = db.getUser(currentUser.id);
    if (updated) setCurrentUser({ ...updated });
  };

  const showNotification = (
    msg: string,
    type: 'info' | 'success' | 'error' = 'info'
  ) => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const login = (email: string, password: string) => {
    const user = db.getUserByEmail(email);
    if (!user || user.password !== password) {
      showNotification('Invalid credentials', 'error');
      return false;
    }
    setCurrentUser({ ...user });
    showNotification(`Welcome back, ${user.name}`, 'success');
    return true;
  };

  const register = (
    userData: Omit<User, 'id' | 'balance' | 'referralCode' | 'createdAt' | 'uplineId' | 'downlineIds' | 'totalEarnings'>,
    referralCode: string | null = null
  ) => {
    if (db.getUserByEmail(userData.email)) {
      showNotification('Email already exists', 'error');
      return false;
    }

    const id = crypto.randomUUID();
    const newUser: User = {
      id,
      ...userData,
      balance: 0,
      referralCode: db.generateReferralCode(id),
      uplineId: null,
      downlineIds: [],
      totalEarnings: 0,
      createdAt: Date.now()
    };

    const user = referralCode
      ? db.registerUserWithReferral(newUser, referralCode)
      : db.createUser(newUser);

    setCurrentUser({ ...user });
    showNotification('Account created', 'success');
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    showNotification('Logged out');
  };

  return (
    <AuthContext.Provider
      value={{ currentUser, login, register, logout, db, showNotification, refreshUser }}
    >
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        {notification && (
          <div className="fixed top-4 right-4 px-4 py-2 bg-white shadow-lg rounded">
            {notification.msg}
          </div>
        )}

        <main className="container mx-auto p-6">
          {!currentUser ? <LoginPage /> : <div>Logged in as {currentUser.name}</div>}
        </main>
      </div>
    </AuthContext.Provider>
  );
}

/* =======================
   LOGIN PAGE
======================= */

function LoginPage() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'customer' as 'customer' | 'provider',
    referralCode: ''
  });

  const submit = () => {
    if (isLogin) {
      login(form.email, form.password);
    } else {
      register(
        {
          email: form.email,
          password: form.password,
          name: form.name,
          role: form.role
        },
        form.referralCode || null
      );
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow">
      <div className="text-center mb-4">
        <Briefcase size={40} className="mx-auto text-purple-600" />
        <h1 className="text-2xl font-bold">Salappi</h1>
      </div>

      <button onClick={() => setIsLogin(!isLogin)}>
        Switch to {isLogin ? 'Register' : 'Login'}
      </button>

      <input placeholder="Email" onChange={e => setForm({ ...form, email: e.target.value })} />
      <input placeholder="Password" type="password" onChange={e => setForm({ ...form, password: e.target.value })} />

      {!isLogin && (
        <>
          <input placeholder="Full Name" onChange={e => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Referral Code" onChange={e => setForm({ ...form, referralCode: e.target.value })} />
        </>
      )}

      <button onClick={submit}>
        {isLogin ? 'Login' : 'Register'}
      </button>
    </div>
  );
}

function LoginPage() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'customer' as 'customer' | 'provider',
    referralCode: ''
  });

  const handleSubmit = () => {
    if (isLogin) {
      login(formData.email, formData.password);
    } else {
      register({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        role: formData.role
      }, formData.referralCode || null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <Briefcase className="mx-auto text-purple-600 mb-3" size={48} />
          <h1 className="text-3xl font-bold text-gray-800">Salappi</h1>
          <p className="text-gray-600">Service Marketplace Platform</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 rounded-lg font-semibold ${
              isLogin ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 rounded-lg font-semibold ${
              !isLogin ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Register
          </button>
        </div>

        <div className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg"
                  placeholder="Juan Dela Cruz"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'customer' | 'provider' })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg"
                >
                  <option value="customer">Customer</option>
                  <option value="provider">Service Provider</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full p-3 border-2 border-gray-300 rounded-lg"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full p-3 border-2 border-gray-300 rounded-lg"
              placeholder="••••••••"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referral Code (Optional)
              </label>
              <input
                type="text"
                value={formData.referralCode}
                onChange={(e) => setFormData({ ...formData, referralCode: e.target.value })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg"
                placeholder="REF..."
              />
            </div>
          )}

          <button
            onClick={handleSubmit}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700"
          >
            {isLogin ? 'Login' : 'Create Account'}
          </button>
        </div>

        {isLogin && (
          <div className="mt-6 text-center text-sm text-gray-600 space-y-1">
            <p>Demo Accounts:</p>
            <p>Admin: admin@salappi.com / admin123</p>
            <p>Provider: provider@salappi.com / provider123</p>
            <p>Customer: customer@salappi.com / customer123</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminDashboard() {
  const { currentUser, logout, db, showNotification } = useAuth();
  const [view, setView] = useState<'announcements' | 'users' | 'services' | 'bookings'>('announcements');
  const [users, setUsers] = useState(db.getAllUsers());
  const [services, setServices] = useState(db.getAllServices());
  const [bookings, setBookings] = useState(db.getAllBookings());
  const [announcements, setAnnouncements] = useState(db.getAllAnnouncements());
  const [newAnnouncement, setNewAnnouncement] = useState<Omit<Announcement, 'id' | 'createdAt'>>({ title: '', content: '', type: 'info' });

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

  const handleDeleteAnnouncement = (id: string) => {
    db.deleteAnnouncement(id);
    setAnnouncements(db.getAllAnnouncements());
    showNotification('Announcement deleted', 'success');
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
    db.deleteService(id);
    setServices(db.getAllServices());
    showNotification('Service deleted', 'success');
  };

  if (!currentUser) return null;

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
              <p className="text-gray-600">Welcome, {currentUser.name}</p>
            </div>
            <button
              onClick={logout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              <LogOut className="inline mr-2" size={18} />
              Logout
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <Users className="text-blue-600 mb-2" size={32} />
            <div className="text-2xl font-bold">{users.length}</div>
            <div className="text-sm text-gray-600">Total Users</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <Briefcase className="text-purple-600 mb-2" size={32} />
            <div className="text-2xl font-bold">{services.length}</div>
            <div className="text-sm text-gray-600">Total Services</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <DollarSign className="text-green-600 mb-2" size={32} />
            <div className="text-2xl font-bold">{bookings.length}</div>
            <div className="text-sm text-gray-600">Total Bookings</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <Bell className="text-orange-600 mb-2" size={32} />
            <div className="text-2xl font-bold">{announcements.length}</div>
            <div className="text-sm text-gray-600">Announcements</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="flex gap-2">
            <button
              onClick={() => setView('announcements')}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold ${
                view === 'announcements' ? 'bg-purple-600 text-white' : 'bg-gray-100'
              }`}
            >
              Announcements
            </button>
            <button
              onClick={() => setView('users')}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold ${
                view === 'users' ? 'bg-purple-600 text-white' : 'bg-gray-100'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setView('services')}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold ${
                view === 'services' ? 'bg-purple-600 text-white' : 'bg-gray-100'
              }`}
            >
              Services
            </button>
            <button
              onClick={() => setView('bookings')}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold ${
                view === 'bookings' ? 'bg-purple-600 text-white' : 'bg-gray-100'
              }`}
            >
              Bookings
            </button>
          </div>
        </div>

        {view === 'announcements' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Create Announcement</h2>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Title"
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg"
                />
                <textarea
                  placeholder="Content"
                  value={newAnnouncement.content}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg h-24"
                />
                <select
                  value={newAnnouncement.type}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, type: e.target.value as 'info' | 'warning' | 'success' })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="success">Success</option>
                </select>
                <button
                  onClick={handleCreateAnnouncement}
                  className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700"
                >
                  Create Announcement
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4">All Announcements</h2>
              <div className="space-y-3">
                {announcements.map(ann => (
                  <div key={ann.id} className="p-4 bg-gray-50 rounded-lg border-2 border-gray-300">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-bold">{ann.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{ann.content}</p>
                        <span className={`text-xs px-2 py-1 rounded-full mt-2 inline-block ${
                          ann.type === 'success' ? 'bg-green-100 text-green-800' :
                          ann.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>{ann.type}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'users' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">All Users</h2>
            <div className="space-y-3">
              {users.map(user => (
                <div key={user.id} className="p-4 bg-gray-50 rounded-lg border-2 border-gray-300">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold">{user.name}</div>
                      <div className="text-sm text-gray-600">{user.email}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Role: {user.role} | Balance: PHP {user.balance.toLocaleString()}
                      </div>
                    </div>
                    {user.id !== currentUser.id && (
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'services' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">All Services</h2>
            <div className="space-y-3">
              {services.map(service => (
                <div key={service.id} className="p-4 bg-gray-50 rounded-lg border-2 border-gray-300">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold">{service.title}</div>
                      <div className="text-sm text-gray-600">{service.description}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Price: PHP {service.price.toLocaleString()} | Provider: {db.getUser(service.providerId)?.name}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteService(service.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'bookings' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">All Bookings</h2>
            <div className="space-y-3">
              {bookings.map(booking => {
                const service = db.getService(booking.serviceId);
                const customer = db.getUser(booking.customerId);
                const provider = db.getUser(booking.providerId);
                
                return (
                  <div key={booking.id} className="p-4 bg-gray-50 rounded-lg border-2 border-gray-300">
                    <div className="font-bold">{service?.title}</div>
                    <div className="text-sm text-gray-600">
                      Customer: {customer?.name} → Provider: {provider?.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      Amount: PHP {booking.amount.toLocaleString()} | Status: {booking.status}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProviderDashboard() {
  const { currentUser, logout, db, showNotification } = useAuth();
  const [view, setView] = useState<'services' | 'bookings' | 'referrals'>('services');
  const [services, setServices] = useState(currentUser ? db.getServicesByProvider(currentUser.id) : []);
  const [bookings, setBookings] = useState(currentUser ? db.getBookingsByProvider(currentUser.id) : []);
  const [newService, setNewService] = useState<Omit<Service, 'id' | 'providerId' | 'status' | 'createdAt'>>({
    title: '',
    description: '',
    category: 'Technology',
    price: 0
  });
  const [editingService, setEditingService] = useState<Service | null>(null);

  const handleCreateService = () => {
    if (!currentUser) return;
    
    if (!newService.title || !newService.description || newService.price <= 0) {
      showNotification('Please fill all fields correctly', 'error');
      return;
    }

    const service: Service = {
      id: `SVC${Date.now()}`,
      providerId: currentUser.id,
      ...newService,
      status: 'active',
      createdAt: Date.now()
    };

    db.createService(service);
    setServices(db.getServicesByProvider(currentUser.id));
    setNewService({ title: '', description: '', category: 'Technology', price: 0 });
    showNotification('Service created successfully', 'success');
  };

  const handleUpdateService = () => {
    if (!editingService || !currentUser) return;
    
    db.updateService(editingService.id, editingService);
    setServices(db.getServicesByProvider(currentUser.id));
    setEditingService(null);
    showNotification('Service updated', 'success');
  };

  const handleDeleteService = (id: string) => {
    if (!currentUser) return;
    
    db.deleteService(id);
    setServices(db.getServicesByProvider(currentUser.id));
    showNotification('Service deleted', 'success');
  };

  const handleCompleteBooking = (bookingId: string) => {
    if (!currentUser) return;
    
    db.updateBooking(bookingId, { status: 'completed' });
    setBookings(db.getBookingsByProvider(currentUser.id));
    showNotification('Booking marked as completed', 'success');
  };

  if (!currentUser) return null;

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Provider Dashboard</h1>
              <p className="text-gray-600">Welcome, {currentUser.name}</p>
            </div>
            <div className="flex gap-4 items-center">
              <div className="text-right">
                <div className="text-sm text-gray-600">Balance</div>
                <div className="text-2xl font-bold text-purple-600">PHP {currentUser.balance.toLocaleString()}</div>
              </div>
              <button onClick={logout} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
                <LogOut className="inline mr-2" size={18} />Logout
              </button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <Briefcase className="text-purple-600 mb-2" size={32} />
            <div className="text-2xl font-bold">{services.length}</div>
            <div className="text-sm text-gray-600">My Services</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <DollarSign className="text-green-600 mb-2" size={32} />
            <div className="text-2xl font-bold">{bookings.length}</div>
            <div className="text-sm text-gray-600">Total Bookings</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <TrendingUp className="text-blue-600 mb-2" size={32} />
            <div className="text-2xl font-bold">PHP {currentUser.totalEarnings.toFixed(2)}</div>
            <div className="text-sm text-gray-600">Referral Earnings</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="flex gap-2">
            <button onClick={() => setView('services')} className={`flex-1 py-2 px-4 rounded-lg font-semibold ${view === 'services' ? 'bg-purple-600 text-white' : 'bg-gray-100'}`}>
              My Services
            </button>
            <button onClick={() => setView('bookings')} className={`flex-1 py-2 px-4 rounded-lg font-semibold ${view === 'bookings' ? 'bg-purple-600 text-white' : 'bg-gray-100'}`}>
              Bookings
            </button>
            <button onClick={() => setView('referrals')} className={`flex-1 py-2 px-4 rounded-lg font-semibold ${view === 'referrals' ? 'bg-purple-600 text-white' : 'bg-gray-100'}`}>
              Referrals
            </button>
          </div>
        </div>

        {view === 'services' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Create New Service</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Service Title" value={newService.title} onChange={(e) => setNewService({ ...newService, title: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg" />
                <textarea placeholder="Description" value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg h-24" />
                <select value={newService.category} onChange={(e) => setNewService({ ...newService, category: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg">
                  <option value="Technology">Technology</option>
                  <option value="Design">Design</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Writing">Writing</option>
                  <option value="Other">Other</option>
                </select>
                <input type="number" placeholder="Price (PHP)" value={newService.price} onChange={(e) => setNewService({ ...newService, price: parseFloat(e.target.value) || 0 })} className="w-full p-3 border-2 border-gray-300 rounded-lg" />
                <button onClick={handleCreateService} className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700">
                  <Plus className="inline mr-2" size={18} />Create Service
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4">My Services</h2>
              <div className="space-y-3">
                {services.map(service => (
                  <div key={service.id} className="p-4 bg-gray-50 rounded-lg border-2 border-gray-300">
                    {editingService?.id === service.id ? (
                      <div className="space-y-2">
                        <input type="text" value={editingService.title} onChange={(e) => setEditingService({ ...editingService, title: e.target.value })} className="w-full p-2 border-2 border-gray-300 rounded-lg" />
                        <textarea value={editingService.description} onChange={(e) => setEditingService({ ...editingService, description: e.target.value })} className="w-full p-2 border-2 border-gray-300 rounded-lg h-20" />
                        <input type="number" value={editingService.price} onChange={(e) => setEditingService({ ...editingService, price: parseFloat(e.target.value) || 0 })} className="w-full p-2 border-2 border-gray-300 rounded-lg" />
                        <div className="flex gap-2">
                          <button onClick={handleUpdateService} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Save</button>
                          <button onClick={() => setEditingService(null)} className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800">{service.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                          <div className="text-xs text-gray-500 mt-2">Category: {service.category}</div>
                        </div>
                        <div className="flex gap-2 items-center">
                          <div className="text-xl font-bold text-purple-600">PHP {service.price.toLocaleString()}</div>
                          <button onClick={() => setEditingService(service)} className="text-blue-600 hover:text-blue-800">
                            <Edit size={18} />
                          </button>
                          <button onClick={() => handleDeleteService(service.id)} className="text-red-600 hover:text-red-800">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {services.length === 0 && <div className="text-center text-gray-500 py-8">No services yet. Create your first service!</div>}
              </div>
            </div>
          </div>
        )}

        {view === 'bookings' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">My Bookings</h2>
            <div className="space-y-3">
              {bookings.map(booking => {
                const service = db.getService(booking.serviceId);
                const customer = db.getUser(booking.customerId);
                return (
                  <div key={booking.id} className="p-4 bg-gray-50 rounded-lg border-2 border-gray-300">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold">{service?.title}</div>
                        <div className="text-sm text-gray-600">Customer: {customer?.name}</div>
                        <div className="text-xs text-gray-500 mt-1">Booking ID: {booking.id}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-purple-600">PHP {booking.amount.toLocaleString()}</div>
                        <div className={`text-xs px-2 py-1 rounded-full mt-1 ${
                          booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                          booking.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>{booking.status.toUpperCase()}</div>
                      </div>
                    </div>
                    {booking.status === 'pending' && (
                      <button onClick={() => handleCompleteBooking(booking.id)} className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 w-full">
                        <CheckCircle className="inline mr-2" size={16} />Mark as Completed
                      </button>
                    )}
                  </div>
                );
              })}
              {bookings.length === 0 && <div className="text-center text-gray-500 py-8">No bookings yet</div>}
            </div>
          </div>
        )}

        {view === 'referrals' && <ReferralSection user={currentUser} db={db} showNotification={showNotification} />}
      </div>
    </div>
  );
}

function CustomerDashboard() {
  const { currentUser, logout, db, showNotification } = useAuth();
  const [view, setView] = useState<'marketplace' | 'bookings' | 'referrals'>('marketplace');
  const [services, setServices] = useState(db.getAllServices().filter(s => s.status === 'active'));
  const [bookings, setBookings] = useState(currentUser ? db.getBookingsByCustomer(currentUser.id) : []);
  const [announcements] = useState(db.getAllAnnouncements());

  const handleBookService = (serviceId: string) => {
    if (!currentUser) return;
    
    const service = db.getService(serviceId);
    if (!service) return;
    
    const user = db.getUser(currentUser.id);
    if (!user) return;

    if (user.balance < service.price) {
      showNotification('Insufficient balance', 'error');
      return;
    }

    user.balance -= service.price;

    const booking: Booking = {
      id: `BKG${Date.now()}`,
      serviceId,
      customerId: currentUser.id,
      providerId: service.providerId,
      amount: service.price,
      status: 'pending',
      escrowStatus: 'held',
      createdAt: Date.now(),
      commissions: []
    };

    db.createBooking(booking);
    setBookings(db.getBookingsByCustomer(currentUser.id));
    showNotification('Service booked! Funds held in escrow.', 'success');
  };

  const handleConfirmBooking = (bookingId: string) => {
    if (!currentUser) return;
    
    const booking = db.getBooking(bookingId);
    if (!booking) return;
    
    const provider = db.getUser(booking.providerId);
    if (!provider) return;
    
    provider.balance += booking.amount;
    
    const commissions = db.distributeCommissions(booking.amount, booking.providerId);
    booking.commissions = commissions;
    
    db.updateBooking(bookingId, { status: 'confirmed', escrowStatus: 'released' });
    setBookings(db.getBookingsByCustomer(currentUser.id));
    showNotification('Payment released to provider!', 'success');
  };

  if (!currentUser) return null;

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Customer Dashboard</h1>
              <p className="text-gray-600">Welcome, {currentUser.name}</p>
            </div>
            <div className="flex gap-4 items-center">
              <div className="text-right">
                <div className="text-sm text-gray-600">Balance</div>
                <div className="text-2xl font-bold text-purple-600">PHP {currentUser.balance.toLocaleString()}</div>
              </div>
              <button onClick={logout} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
                <LogOut className="inline mr-2" size={18} />Logout
              </button>
            </div>
          </div>
        </div>

        {announcements.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Bell className="text-orange-600" size={24} />Announcements
            </h2>
            <div className="space-y-3">
              {announcements.slice(0, 3).map(ann => (
                <div key={ann.id} className={`p-4 rounded-lg border-2 ${
                  ann.type === 'success' ? 'bg-green-50 border-green-300' :
                  ann.type === 'warning' ? 'bg-yellow-50 border-yellow-300' :
                  'bg-blue-50 border-blue-300'
                }`}>
                  <h3 className="font-bold">{ann.title}</h3>
                  <p className="text-sm mt-1">{ann.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="flex gap-2">
            <button onClick={() => setView('marketplace')} className={`flex-1 py-2 px-4 rounded-lg font-semibold ${view === 'marketplace' ? 'bg-purple-600 text-white' : 'bg-gray-100'}`}>
              <Search className="inline mr-2" size={18} />Marketplace
            </button>
            <button onClick={() => setView('bookings')} className={`flex-1 py-2 px-4 rounded-lg font-semibold ${view === 'bookings' ? 'bg-purple-600 text-white' : 'bg-gray-100'}`}>
              <Briefcase className="inline mr-2" size={18} />My Bookings
            </button>
            <button onClick={() => setView('referrals')} className={`flex-1 py-2 px-4 rounded-lg font-semibold ${view === 'referrals' ? 'bg-purple-600 text-white' : 'bg-gray-100'}`}>
              <Share2 className="inline mr-2" size={18} />Referrals
            </button>
          </div>
        </div>

        {view === 'marketplace' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Available Services</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {services.map(service => {
                const provider = db.getUser(service.providerId);
                return (
                  <div key={service.id} className="p-4 bg-gray-50 rounded-lg border-2 border-gray-300">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800">{service.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                        <div className="text-xs text-gray-500 mt-2">
                          By: {provider?.name} | {service.category}
                        </div>
                      </div>
                      <div className="text-xl font-bold text-purple-600">PHP {service.price.toLocaleString()}</div>
                    </div>
                    {service.providerId !== currentUser.id && (
                      <button onClick={() => handleBookService(service.id)} className="w-full bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700">
                        Book Service
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'bookings' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">My Bookings</h2>
            <div className="space-y-3">
              {bookings.map(booking => {
                const service = db.getService(booking.serviceId);
                const provider = db.getUser(booking.providerId);
                return (
                  <div key={booking.id} className="p-4 bg-gray-50 rounded-lg border-2 border-gray-300">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold">{service?.title}</div>
                        <div className="text-sm text-gray-600">Provider: {provider?.name}</div>
                        <div className="text-xs text-gray-500 mt-1">Booking ID: {booking.id}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-purple-600">PHP {booking.amount.toLocaleString()}</div>
                        <div className={`text-xs px-2 py-1 rounded-full mt-1 ${
                          booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                          booking.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>{booking.status.toUpperCase()}</div>
                        <div className="text-xs text-gray-500 mt-1">Escrow: {booking.escrowStatus}</div>
                      </div>
                    </div>
                    {booking.status === 'completed' && (
                      <button onClick={() => handleConfirmBooking(booking.id)} className="mt-3 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 w-full">
                        <CheckCircle className="inline mr-2" size={16} />Confirm & Release Payment
                      </button>
                    )}
                    {booking.commissions && booking.commissions.length > 0 && booking.status === 'confirmed' && (
                      <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="text-sm font-semibold text-green-800 mb-2">Referral Commissions:</div>
                        {booking.commissions.map((comm, i) => (
                          <div key={i} className="text-xs text-green-700">L{comm.level} - {comm.referrerName}: PHP {comm.amount.toFixed(2)}</div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {bookings.length === 0 && <div className="text-center text-gray-500 py-8">No bookings yet</div>}
            </div>
          </div>
        )}

        {view === 'referrals' && <ReferralSection user={currentUser} db={db} showNotification={showNotification} />}
      </div>
    </div>
  );
}

interface ReferralSectionProps {
  user: User;
  db: Database;
  showNotification: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

function ReferralSection({ user, db, showNotification }: ReferralSectionProps) {
  const copyReferralLink = (code: string) => {
    navigator.clipboard.writeText(`salappi.com/ref/${code}`);
    showNotification('Referral link copied!', 'success');
  };

  const ReferralTree = ({ userId, depth = 0 }: { userId: string; depth?: number }) => {
    const treeUser = db.getUser(userId);
    if (!treeUser || depth > 3) return null;

    return (
      <div className="ml-6">
        <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg mb-2">
          <UserPlus size={16} className="text-purple-600" />
          <span className="text-sm font-medium">{treeUser.name}</span>
          <span className="text-xs text-gray-500">L{depth + 1}</span>
          <span className="text-xs text-green-600">PHP {treeUser.totalEarnings.toFixed(2)}</span>
        </div>
        {treeUser.downlineIds && treeUser.downlineIds.length > 0 && (
          <div className="border-l-2 border-purple-200 pl-2">
            {treeUser.downlineIds.map(childId => (
              <ReferralTree key={childId} userId={childId} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Your Referral Link</h2>
        <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
          <div className="flex items-center justify-between">
            <code className="text-sm text-purple-800">salappi.com/ref/{user.referralCode}</code>
            <button onClick={() => copyReferralLink(user.referralCode)} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
              <Copy size={16} className="inline mr-1" />Copy
            </button>
          </div>
        </div>
        <div className="mt-4 grid md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-gray-600">Total Referrals</div>
            <div className="text-2xl font-bold text-blue-600">{user.downlineIds?.length || 0}</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-gray-600">Total Earnings</div>
            <div className="text-2xl font-bold text-green-600">PHP {user.totalEarnings.toFixed(2)}</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-sm text-gray-600">Commission Rates</div>
            <div className="text-lg font-bold text-purple-600">5-3-2-1-1%</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Your Downline Network</h2>
        {user.downlineIds && user.downlineIds.length > 0 ? (
          <div>
            {user.downlineIds.map(childId => (
              <ReferralTree key={childId} userId={childId} depth={0} />
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">No referrals yet. Share your link to start building your network!</div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Commission Structure</h2>
        <div className="space-y-2">
          {[
            { level: 1, rate: '5%', desc: 'Direct referrals' },
            { level: 2, rate: '3%', desc: 'Second level' },
            { level: 3, rate: '2%', desc: 'Third level' },
            { level: 4, rate: '1%', desc: 'Fourth level' },
            { level: 5, rate: '1%', desc: 'Fifth level' }
          ].map(tier => (
            <div key={tier.level} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="font-semibold">Level {tier.level}</span>