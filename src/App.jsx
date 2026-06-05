import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Calendar,
  Camera,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Edit3,
  Image as ImageIcon,
  List,
  Lock,
  LogOut,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  Smartphone,
  Trash2,
  UploadCloud,
  Wrench,
  X,
} from 'lucide-react';
import { PHOTO_BUCKET, isSupabaseConfigured, supabase } from './supabaseClient';
import LogsView from './LogsView';

const ACCESS_PASSWORDS = {
  basic: import.meta.env.VITE_ACCESS_PASSWORD || '25913229',
  admin: '11316828',
};
const MAX_PHOTOS = 8;

const STATUS_OPTIONS = ['Recibido', 'Reparado', 'Garantia', 'Entregado', 'Devuelto'];
const RECEPTION_OPTIONS = [
  'Encendido',
  'Apagado',
  'Reiniciandose',
  'Pantalla rota',
  'Mojado',
  'Bloqueado',
  'Sin bateria',
];

const emptyRepair = {
  nombre: '',
  apellido: '',
  cedula: '',
  telefono: '',
  direccion: '',
  recibido_por: '',
  marca: '',
  modelo: '',
  reparacion: '',
  observaciones: '',
  dias_garantia: '',
  precio: '',
  clave_equipo: '',
  patron_equipo: [],
  estado: 'Recibido',
  estado_recepcion: 'Encendido',
  fotos: [],
};

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const formatMoney = (value) => moneyFormatter.format(Number(value) || 0);
const parseAmount = (value) => Number.parseFloat(value || 0) || 0;
const formatDate = (value) => (value ? dateFormatter.format(new Date(value)) : 'Sin fecha');
const normalize = (value) => String(value || '').toLowerCase().trim();

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
};

const startOfWeek = () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = today.getDay() || 7;
  today.setDate(today.getDate() - day + 1);
  return today.getTime();
};

const createClientId = () => {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getPhotoUrl = (photo) => {
  if (!photo) return '';
  if (typeof photo === 'string') return photo;
  return photo.preview || photo.url || '';
};

const getPhotoPath = (photo) => {
  if (!photo || typeof photo === 'string') return '';
  return photo.path || '';
};

const buildRepairWhatsAppMessage = (repair) => {
  const photoUrls = (repair.fotos || []).map(getPhotoUrl).filter(Boolean);
  const lines = [
    'MOVILCELL - REGISTRO DE SERVICIO TECNICO',
    '',
    `Cliente: ${repair.nombre || ''} ${repair.apellido || ''}`.trim(),
    `Cedula: ${repair.cedula || 'Sin dato'}`,
    `Telefono: ${repair.telefono || 'Sin dato'}`,
    `Direccion: ${repair.direccion || 'Sin dato'}`,
    '',
    `Equipo: ${repair.marca || 'Sin marca'} ${repair.modelo || 'Sin modelo'}`,
    `Condicion de recepcion: ${repair.estado_recepcion || 'Sin dato'}`,
    `Estado: ${repair.estado || 'Sin estado'}`,
    `Reparacion: ${repair.reparacion || 'Sin dato'}`,
    `Observacion: ${repair.observaciones || 'Sin dato'}`,
    `Dias de garantia: ${repair.dias_garantia || 0}`,
    `Precio: ${formatMoney(repair.precio)}`,
    '',
    `Fecha de ingreso: ${formatDate(repair.fecha_ingreso)}`,
    `Ultima actualizacion: ${repair.fecha_actualizacion ? formatDate(repair.fecha_actualizacion) : 'Sin cambios'}`,
    `Fecha de entrega: ${repair.fecha_entregado ? formatDate(repair.fecha_entregado) : 'Pendiente'}`,
  ];

  if (photoUrls.length) {
    lines.push('', 'Evidencia fotografica:');
    photoUrls.forEach((url, index) => lines.push(`${index + 1}. ${url}`));
  }

  return lines.join('\n');
};

const openRepairWhatsApp = (repair) => {
  const phone = String(repair.telefono || '').replace(/\D/g, '');
  const text = encodeURIComponent(buildRepairWhatsAppMessage(repair));
  const phoneParam = phone ? `phone=${phone}&` : '';
  window.open(`https://api.whatsapp.com/send?${phoneParam}text=${text}`, '_blank', 'noopener,noreferrer');
};

const getLogStatus = (log) => {
  return log?.changed_fields?.estado?.new || '';
};

const shouldNotifyLog = (log) => {
  const status = getLogStatus(log);
  return log?.action === 'created' || (log?.action === 'status_changed' && ['Reparado', 'Entregado', 'Devuelto', 'Garantia'].includes(status));
};

const getNotificationCopy = (log) => {
  const label = log.repair_label || 'Equipo sin nombre';
  const status = getLogStatus(log);

  if (log.action === 'created') {
    return {
      title: 'Nuevo servicio tecnico recibido',
      body: `${label} fue registrado en Quality.`,
    };
  }

  const statusMessages = {
    Reparado: 'Equipo reparado',
    Entregado: 'Equipo entregado',
    Devuelto: 'Equipo devuelto',
    Garantia: 'Equipo recibido por garantia',
  };

  return {
    title: statusMessages[status] || 'Cambio en equipo',
    body: `${label} cambio a estado ${status || 'actualizado'}.`,
  };
};

const formatPattern = (pattern) => {
  if (!Array.isArray(pattern) || pattern.length === 0) return '';
  return pattern.join('-');
};

const showRepairNotification = async (log) => {
  if (!shouldNotifyLog(log) || !('Notification' in window) || Notification.permission !== 'granted') return;

  const { title, body } = getNotificationCopy(log);
  new Notification(title, { body, icon: '/icons/icon-192.png' });
};

function App() {
  const [isUnlocked, setIsUnlocked] = useState(() => sessionStorage.getItem('quality-unlocked') === 'true');
  const [userRole, setUserRole] = useState(() => sessionStorage.getItem('quality-role') || 'basic');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [repairs, setRepairs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [logs, setLogs] = useState([]);
  const [currentRepair, setCurrentRepair] = useState(emptyRepair);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone);
  const [notificationStatus, setNotificationStatus] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));

  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const [repairsResponse, expensesResponse, logsResponse] = await Promise.all([
      supabase.from('repairs').select('*').order('fecha_ingreso', { ascending: false }),
      supabase.from('expenses').select('*').order('fecha', { ascending: false }),
      supabase.from('repair_logs').select('*').order('created_at', { ascending: false }).limit(300),
    ]);

    if (repairsResponse.error || expensesResponse.error) {
      const message = repairsResponse.error?.message || expensesResponse.error?.message;
      setError(`No pude leer Supabase: ${message}`);
      setLoading(false);
      return;
    }

    setRepairs(repairsResponse.data || []);
    setExpenses(expensesResponse.data || []);
    if (!logsResponse.error) setLogs(logsResponse.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isUnlocked || !isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    loadData();

    const channel = supabase
      .channel('quality-repair-live', { config: { broadcast: { ack: true } } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repairs' }, () => {
        console.log('Cambio detectado en repairs');
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        console.log('Cambio detectado en expenses');
        loadData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'repair_logs' }, (payload) => {
        console.log('Nuevo log insertado:', payload);
        setLogs((currentLogs) => [payload.new, ...currentLogs.filter((log) => log.id !== payload.new.id)].slice(0, 300));
        showRepairNotification(payload.new);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Suscripción a Supabase Realtime establecida correctamente');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error en la suscripción a Supabase Realtime');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isUnlocked, loadData, showRepairNotification]);

  const finance = useMemo(() => {
    const today = startOfToday();
    const week = startOfWeek();
    let ingresosHoy = 0;
    let ingresosSemana = 0;
    let gastosHoy = 0;
    let gastosSemana = 0;

    repairs.forEach((repair) => {
      if (repair.estado !== 'Entregado') return;
      const incomeDate = repair.fecha_entregado || repair.fecha_actualizacion || repair.fecha_ingreso;
      const timestamp = new Date(incomeDate).getTime();
      const amount = parseAmount(repair.precio);
      if (timestamp >= today) ingresosHoy += amount;
      if (timestamp >= week) ingresosSemana += amount;
    });

    expenses.forEach((expense) => {
      const timestamp = new Date(expense.fecha).getTime();
      const amount = parseAmount(expense.monto);
      if (timestamp >= today) gastosHoy += amount;
      if (timestamp >= week) gastosSemana += amount;
    });

    return { ingresosHoy, ingresosSemana, gastosHoy, gastosSemana };
  }, [repairs, expenses]);

  const unlock = (role = 'basic') => {
    sessionStorage.setItem('quality-unlocked', 'true');
    sessionStorage.setItem('quality-role', role);
    setIsUnlocked(true);
    setUserRole(role);
  };

  const navigate = (tab, repair = null) => {
    setActiveTab(tab);
    if (tab === 'new') setCurrentRepair(repair ? { ...emptyRepair, ...repair } : emptyRepair);
  };

  const lockSession = () => {
    sessionStorage.removeItem('quality-unlocked');
    sessionStorage.removeItem('quality-role');
    setActiveTab('dashboard');
    setIsUnlocked(false);
    setUserRole('basic');
  };

  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      setNotificationStatus('unsupported');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationStatus(permission);
  };

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setIsInstalled(true);
    }
  };

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (!isUnlocked || !isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    loadData();

    const channelName = `quality-repair-live-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repairs' }, () => {
        console.log('Cambio detectado en repairs');
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        console.log('Cambio detectado en expenses');
        loadData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'repair_logs' }, (payload) => {
        console.log('Nuevo log insertado:', payload);
        setLogs((currentLogs) => [payload.new, ...currentLogs.filter((log) => log.id !== payload.new.id)].slice(0, 300));
        showRepairNotification(payload.new);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Suscripción a Supabase Realtime establecida correctamente');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error en la suscripción a Supabase Realtime');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isUnlocked, loadData]);

  if (!isUnlocked) return <LoginScreen onUnlock={unlock} />;

  if (!isSupabaseConfigured) return <SetupScreen />;

  if (loading) {
    return (
      <Shell activeTab={activeTab} navigate={navigate} onLock={lockSession} userRole={userRole}>
        <LoadingState />
      </Shell>
    );
  }

  return (
    <Shell
      activeTab={activeTab}
      navigate={navigate}
      onLock={lockSession}
      userRole={userRole}
      onInstall={installPrompt && !isInstalled ? installApp : null}
      onEnableNotifications={notificationStatus !== 'unsupported' ? enableNotifications : null}
      notificationStatus={notificationStatus}
    >
      {error && <SystemMessage type="error" message={error} />}

      {activeTab === 'dashboard' && (
        <Dashboard
          finance={finance}
          repairs={repairs}
          expenses={expenses}
          onEdit={(repair) => navigate('new', repair)}
          userRole={userRole}
          onEnableNotifications={enableNotifications}
          notificationStatus={notificationStatus}
        />
      )}

      {activeTab === 'list' && (
        <RepairList
          repairs={repairs}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onEdit={(repair) => navigate('new', repair)}
        />
      )}

      {activeTab === 'new' && (
        <RepairForm initialData={currentRepair} onComplete={() => navigate('list')} />
      )}

      {activeTab === 'expenses' && (
        <ExpenseForm expenses={expenses} />
      )}

      {activeTab === 'logs' && (
        <LogsView logs={logs} />
      )}
    </Shell>
  );
}

function Shell({ activeTab, navigate, onLock, userRole, onInstall, onEnableNotifications, notificationStatus, children }) {
  const navItems = [
    { id: 'dashboard', label: 'Panel', icon: Activity },
    { id: 'list', label: 'Ordenes', icon: List },
    { id: 'new', label: 'Nuevo', icon: Plus },
    ...(userRole === 'admin' ? [
      { id: 'expenses', label: 'Gastos', icon: DollarSign },
      { id: 'logs', label: 'Logs', icon: ClipboardList },
    ] : []),
  ];

  return (
    <div className="app-shell">
      <nav className="topbar">
        <button className="brand" type="button" onClick={() => navigate('dashboard')} aria-label="Ir al panel">
          <span>Quality</span>
        </button>

        <div className="nav-actions">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`icon-button ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => navigate(item.id)}
                title={item.label}
                aria-label={item.label}
              >
                <Icon size={20} />
              </button>
            );
          })}
          <button
            type="button"
            className="icon-button"
            onClick={() => window.location.reload()}
            title="Actualizar pagina"
            aria-label="Actualizar pagina"
          >
            <RefreshCw size={20} />
          </button>
          <button
            type="button"
            className="icon-button logout-button"
            onClick={onLock}
            title="Cerrar sesion"
            aria-label="Cerrar sesion"
          >
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <main className="main-content">{children}</main>
    </div>
  );
}

function LoginScreen({ onUnlock }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (password === ACCESS_PASSWORDS.admin) {
      onUnlock('admin');
      return;
    }
    if (password === ACCESS_PASSWORDS.basic) {
      onUnlock('basic');
      return;
    }

    setError(true);
    setPassword('');
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <Lock size={46} className="login-icon" />
        <h1>Quality</h1>
        <p>Protocolo de acceso</p>

        <input
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError(false);
          }}
          placeholder="Ingrese clave de autorizacion"
          autoFocus
          className={error ? 'has-error' : ''}
        />

        {error && <small className="error-text">Acceso denegado</small>}

        <button type="submit" className="primary-button">
          Desbloquear sistema
        </button>
      </form>
    </div>
  );
}

function SetupScreen() {
  return (
    <div className="setup-screen">
      <div className="setup-panel">
        <AlertTriangle size={34} />
        <h1>Falta conectar Supabase</h1>
        <p>
          Crea el archivo <code>.env</code> con tus credenciales y ejecuta el SQL de
          <code> supabase/schema.sql</code> en tu proyecto Supabase.
        </p>
        <pre>{`VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_SUPABASE_ANON_KEY
VITE_ACCESS_PASSWORD=25913229`}</pre>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="loading-state">
      <Activity size={46} />
      <p>Inicializando sistema Quality...</p>
    </div>
  );
}

function SystemMessage({ type = 'info', message }) {
  return (
    <div className={`system-message ${type}`}>
      <AlertTriangle size={18} />
      <span>{message}</span>
    </div>
  );
}

function Dashboard({ finance, repairs, expenses, onEdit, userRole, onEnableNotifications, notificationStatus }) {
  const [activeSearch, setActiveSearch] = useState('');
  const [expenseSearch, setExpenseSearch] = useState('');
  const activeRepairs = repairs.filter((repair) => ['Recibido', 'Reparado', 'Garantia'].includes(repair.estado)).length;
  const deliveredToday = repairs.filter((repair) => {
    if (repair.estado !== 'Entregado') return false;
    const timestamp = new Date(repair.fecha_entregado || repair.fecha_actualizacion || repair.fecha_ingreso).getTime();
    return timestamp >= startOfToday();
  }).length;
  const latestActive = repairs
    .filter((repair) => repair.estado !== 'Entregado' && repair.estado !== 'Devuelto')
    .filter((repair) => {
      const query = normalize(activeSearch);
      if (!query) return true;
      return [
        repair.nombre,
        repair.apellido,
        repair.marca,
        repair.modelo,
        repair.reparacion,
        repair.estado,
      ].map(normalize).join(' ').includes(query);
    });
  const latestExpenses = expenses
    .filter((expense) => {
      const query = normalize(expenseSearch);
      if (!query) return true;
      return normalize(expense.concepto).includes(query);
    });

  return (
    <section className="view-stack">
      <ViewHeader
        title={userRole === 'admin' ? 'Telemetria operativa' : 'Panel de control'}
        subtitle={userRole === 'admin' ? 'Control diario de ordenes, ingresos, egresos y equipos activos.' : 'Control de ordenes activas y gastos.'}
      />

      {userRole === 'admin' && (
        <>
          <div className="metric-grid">
            <StatCard title="Ingresos hoy" value={formatMoney(finance.ingresosHoy)} tone="income" />
            <StatCard title="Ingresos semana" value={formatMoney(finance.ingresosSemana)} tone="income" />
            <StatCard title="Gastos hoy" value={formatMoney(finance.gastosHoy)} tone="expense" />
            <StatCard title="Gastos semana" value={formatMoney(finance.gastosSemana)} tone="expense" />
          </div>

          <div className="dashboard-grid">
            <Panel title="Equipos en taller" icon={Smartphone}>
              <strong className="big-number">{activeRepairs}</strong>
              <span className="muted">Recibidos o reparados pendientes de salida</span>
            </Panel>

            <Panel title="Rentabilidad semanal" icon={Activity}>
              <strong className={`big-number ${finance.ingresosSemana - finance.gastosSemana >= 0 ? 'positive' : 'negative'}`}>
                {formatMoney(finance.ingresosSemana - finance.gastosSemana)}
              </strong>
              <span className="muted">{deliveredToday} ordenes entregadas hoy</span>
            </Panel>
          </div>
        </>
      )}

      <div className={`dashboard-grid ${userRole === 'basic' ? 'single-panel' : ''}`}>
        <Panel title="Ordenes activas recientes" icon={List}>
          <CompactSearch
            value={activeSearch}
            onChange={setActiveSearch}
            placeholder="Buscar orden activa..."
          />
          <div className="compact-list scrollable">
            {latestActive.length === 0 && <EmptyState text="No hay equipos activos." />}
            {latestActive.map((repair) => (
              <button key={repair.id} type="button" className="compact-row" onClick={() => onEdit(repair)}>
                <span>
                  <strong>{repair.nombre} {repair.apellido}</strong>
                  <small>{repair.marca} {repair.modelo}</small>
                </span>
                <StatusBadge status={repair.estado} />
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Ultimos gastos" icon={DollarSign}>
          <CompactSearch
            value={expenseSearch}
            onChange={setExpenseSearch}
            placeholder="Buscar gasto reciente..."
          />
          <div className="compact-list scrollable">
            {latestExpenses.length === 0 && <EmptyState text="No hay gastos registrados." />}
            {latestExpenses.map((expense) => (
              <div key={expense.id} className="compact-row static">
                <span>
                  <strong>{expense.concepto}</strong>
                  <small>{formatDate(expense.fecha)}</small>
                </span>
                <b className="negative">{formatMoney(expense.monto)}</b>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  );
}

function CompactSearch({ value, onChange, placeholder }) {
  return (
    <div className="compact-search">
      <Search size={16} />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function StatCard({ title, value, tone }) {
  return (
    <div className={`stat-card ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <Icon size={20} />
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ViewHeader({ title, subtitle, action }) {
  return (
    <header className="view-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

function RepairList({ repairs, searchTerm, setSearchTerm, onEdit }) {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const filteredRepairs = useMemo(() => {
    const query = normalize(searchTerm);
    if (!query) return repairs;

    return repairs.filter((repair) => {
      const haystack = [
        repair.nombre,
        repair.apellido,
        repair.cedula,
        repair.telefono,
        repair.marca,
        repair.modelo,
        repair.reparacion,
        repair.estado,
      ].map(normalize).join(' ');
      return haystack.includes(query);
    });
  }, [repairs, searchTerm]);

  const deleteRepair = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setMessage('');

    const paths = (deleteTarget.fotos || []).map(getPhotoPath).filter(Boolean);
    if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths);

    const { error } = await supabase.from('repairs').delete().eq('id', deleteTarget.id);
    if (error) {
      setMessage(`No se pudo eliminar: ${error.message}`);
    } else {
      setDeleteTarget(null);
    }

    setBusy(false);
  };

  return (
    <section className="view-stack">
      <ViewHeader
        title="Registro de equipos"
        subtitle={`${filteredRepairs.length} ordenes visibles`}
        action={
          <div className="search-box">
            <Search size={17} />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar cliente, cedula, equipo..."
            />
          </div>
        }
      />

      {message && <SystemMessage type="error" message={message} />}

      <div className="repair-grid">
        {filteredRepairs.length === 0 && <EmptyState text="No se encontraron registros." />}
        {filteredRepairs.map((repair) => (
          <article key={repair.id} className="repair-card">
            <div className="card-heading">
              <div>
                <h2>{repair.nombre} {repair.apellido}</h2>
                <p>{repair.marca} {repair.modelo}</p>
              </div>
              <StatusBadge status={repair.estado} />
            </div>

            <dl className="record-details">
              <div><dt>Reparacion</dt><dd>{repair.reparacion}</dd></div>
              <div><dt>Observacion</dt><dd>{repair.observaciones}</dd></div>
              <div><dt>Garantia</dt><dd>{repair.dias_garantia || 0} dias</dd></div>
              <div><dt>Condicion</dt><dd>{repair.estado_recepcion || 'Sin dato'}</dd></div>
              <div><dt>Precio</dt><dd>{formatMoney(repair.precio)}</dd></div>
              <div><dt>Ingreso</dt><dd>{formatDate(repair.fecha_ingreso)}</dd></div>
              <div><dt>Actualizado</dt><dd>{repair.fecha_actualizacion ? formatDate(repair.fecha_actualizacion) : 'Sin cambios'}</dd></div>
            </dl>

            <PhotoStrip photos={repair.fotos || []} />

            <div className="button-row repair-actions">
              <button type="button" className="secondary-button" onClick={() => onEdit(repair)}>
                <Edit3 size={17} />
                Abrir
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => openRepairWhatsApp(repair)}
                title="Enviar registro por WhatsApp"
              >
                <ReceiptText size={17} />
                WhatsApp
              </button>
              <button type="button" className="danger-button icon-only card-delete-button" onClick={() => setDeleteTarget(repair)} title="Eliminar" aria-label="Eliminar">
                <Trash2 size={20} />
              </button>
            </div>
          </article>
        ))}
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Eliminar registro"
          message={`Se eliminara la orden de ${deleteTarget.nombre} ${deleteTarget.apellido} y sus fotos guardadas.`}
          confirmText={busy ? 'Eliminando...' : 'Eliminar'}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={deleteRepair}
          disabled={busy}
          destructive
        />
      )}
    </section>
  );
}

function PhotoStrip({ photos }) {
  const visiblePhotos = (photos || []).slice(0, 4);
  if (visiblePhotos.length === 0) {
    return (
      <div className="photo-strip empty">
        <ImageIcon size={16} />
        Sin fotos
      </div>
    );
  }

  return (
    <div className="photo-strip">
      {visiblePhotos.map((photo, index) => (
        <a key={`${getPhotoUrl(photo)}-${index}`} href={getPhotoUrl(photo)} target="_blank" rel="noreferrer" title="Abrir foto">
          <img src={getPhotoUrl(photo)} alt={`Evidencia ${index + 1}`} />
        </a>
      ))}
      {photos.length > visiblePhotos.length && <span>+{photos.length - visiblePhotos.length}</span>}
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`status-badge ${normalize(status)}`}>{status || 'Sin estado'}</span>;
}

function RepairForm({ initialData, onComplete }) {
  const [formData, setFormData] = useState({ ...emptyRepair, ...initialData });
  const [photos, setPhotos] = useState(initialData?.fotos || []);
  const [photosToDelete, setPhotosToDelete] = useState([]);
  const [saving, setSaving] = useState(false);
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const [showPhotoWarning, setShowPhotoWarning] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setFormData({ ...emptyRepair, ...initialData });
    setPhotos(initialData?.fotos || []);
    setPhotosToDelete([]);
    setMessage('');
  }, [initialData]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleImageCapture = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setProcessingPhotos(true);
    setMessage('');

    try {
      const availableSlots = Math.max(MAX_PHOTOS - photos.length, 0);
      const selectedFiles = files.slice(0, availableSlots);
      const compressedPhotos = await Promise.all(selectedFiles.map(compressImage));
      setPhotos((current) => [...current, ...compressedPhotos]);
    } catch (error) {
      setMessage(`No pude procesar una foto: ${error.message}`);
    } finally {
      setProcessingPhotos(false);
      event.target.value = '';
    }
  };

  const removePhoto = (index) => {
    setPhotos((current) => {
      const photo = current[index];
      const path = getPhotoPath(photo);
      if (path) setPhotosToDelete((paths) => [...paths, path]);
      return current.filter((_, photoIndex) => photoIndex !== index);
    });
  };

  const uploadPhotos = async (recordId, now) => {
    const storedPhotos = [];

    for (const photo of photos) {
      if (!photo.pending) {
        storedPhotos.push(photo);
        continue;
      }

      const path = `${recordId}/${Date.now()}-${storedPhotos.length}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, photo.blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
      storedPhotos.push({
        path,
        url: data.publicUrl,
        nombre: photo.name,
        fecha: now,
      });
    }

    return storedPhotos;
  };

  const saveRepair = async () => {
    setSaving(true);
    setMessage('');

    try {
      const now = new Date().toISOString();
      const isEditing = Boolean(formData.id);
      const recordId = formData.id || createClientId();
      const uploadedPhotos = await uploadPhotos(recordId, now);
      const becameDelivered = formData.estado === 'Entregado' && initialData?.estado !== 'Entregado';

      const payload = {
        nombre: formData.nombre.trim(),
        apellido: formData.apellido.trim(),
        cedula: formData.cedula.trim(),
        telefono: formData.telefono.trim(),
        direccion: formData.direccion.trim(),
        recibido_por: formData.recibido_por.trim(),
        marca: formData.marca.trim(),
        modelo: formData.modelo.trim(),
        reparacion: formData.reparacion.trim(),
        observaciones: formData.observaciones.trim(),
        dias_garantia: Number.parseInt(formData.dias_garantia, 10) || 0,
        precio: parseAmount(formData.precio),
        clave_equipo: formData.clave_equipo.trim(),
        patron_equipo: Array.isArray(formData.patron_equipo) ? formData.patron_equipo : [],
        estado: formData.estado,
        estado_recepcion: formData.estado_recepcion,
        fotos: uploadedPhotos,
        fecha_actualizacion: isEditing ? now : null,
        fecha_entregado: becameDelivered ? now : formData.estado === 'Entregado' ? formData.fecha_entregado || now : null,
      };

      let response;
      if (isEditing) {
        response = await supabase.from('repairs').update(payload).eq('id', recordId);
      } else {
        response = await supabase.from('repairs').insert({ id: recordId, ...payload, fecha_ingreso: now });
      }

      if (response.error) throw response.error;

      if (photosToDelete.length) {
        await supabase.storage.from(PHOTO_BUCKET).remove(photosToDelete);
      }

      onComplete();
    } catch (error) {
      setMessage(`No pude guardar el registro: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (photos.length === 0) {
      setShowPhotoWarning(true);
      return;
    }
    saveRepair();
  };

  return (
    <section className="form-shell">
      <ViewHeader
        title={formData.id ? 'Modificar protocolo' : 'Nuevo ingreso'}
        subtitle={formData.id ? `Ultima actualizacion: ${formData.fecha_actualizacion ? formatDate(formData.fecha_actualizacion) : 'sin cambios'}` : 'Fecha de ingreso automatica al guardar'}
      />

      {message && <SystemMessage type="error" message={message} />}

      <form className="repair-form" onSubmit={handleSubmit}>
        <fieldset>
          <legend>Cliente</legend>
          <InputField label="Nombre" name="nombre" value={formData.nombre} onChange={handleChange} required />
          <InputField label="Apellido" name="apellido" value={formData.apellido} onChange={handleChange} required />
          <InputField label="Cedula" name="cedula" value={formData.cedula} onChange={handleChange} />
          <InputField label="Telefono" name="telefono" value={formData.telefono} onChange={handleChange} inputMode="tel" />
          <InputField label="Direccion" name="direccion" value={formData.direccion} onChange={handleChange} className="wide" />
        </fieldset>

        <fieldset>
          <legend>Equipo</legend>
          <InputField label="Marca" name="marca" value={formData.marca} onChange={handleChange} required />
          <InputField label="Modelo" name="modelo" value={formData.modelo} onChange={handleChange} required />
          <TextAreaField label="Reparacion / diagnostico" name="reparacion" value={formData.reparacion} onChange={handleChange} required className="wide" />
          <TextAreaField label="Observaciones" name="observaciones" value={formData.observaciones} onChange={handleChange} required className="wide" />
          <InputField label="Dias de garantia" name="dias_garantia" type="number" min="0" value={formData.dias_garantia} onChange={handleChange} required />
          <InputField label="Precio total" name="precio" type="number" min="0" step="100" value={formData.precio} onChange={handleChange} required />
          <InputField label="PIN / contrasena del equipo" name="clave_equipo" value={formData.clave_equipo} onChange={handleChange} autoComplete="off" />
          <SelectField label="Condicion de recepcion" name="estado_recepcion" value={formData.estado_recepcion} onChange={handleChange} options={RECEPTION_OPTIONS} required />
          <SelectField label="Estado de reparacion" name="estado" value={formData.estado} onChange={handleChange} options={STATUS_OPTIONS} required />
          <InputField label="Recibido por" name="recibido_por" value={formData.recibido_por} onChange={handleChange} required />
          <PatternLockField
            label="Patron del equipo"
            value={formData.patron_equipo}
            onChange={(pattern) => setFormData((current) => ({ ...current, patron_equipo: pattern }))}
          />

          <section className="photo-uploader">
            <div className="photo-header">
              <div>
                <h2>Evidencia fotografica</h2>
                <p>{photos.length}/{MAX_PHOTOS} imagenes del estado del equipo</p>
              </div>
              <UploadCloud size={22} />
            </div>

            <div className="photo-preview-grid">
              {photos.map((photo, index) => (
                <div key={`${getPhotoUrl(photo)}-${index}`} className="photo-preview">
                  <img src={getPhotoUrl(photo)} alt={`Foto del equipo ${index + 1}`} />
                  <button type="button" onClick={() => removePhoto(index)} title="Quitar foto" aria-label="Quitar foto">
                    <X size={18} />
                  </button>
                </div>
              ))}
              {photos.length === 0 && <EmptyState text="Aun no hay evidencia fotografica." />}
            </div>

            <label className={`camera-button ${photos.length >= MAX_PHOTOS ? 'disabled' : ''}`}>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handleImageCapture}
                disabled={photos.length >= MAX_PHOTOS || processingPhotos}
              />
              <Camera size={20} />
              {processingPhotos ? 'Procesando fotos...' : 'Capturar o seleccionar fotos'}
            </label>
          </section>
        </fieldset>

        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={saving || processingPhotos}>
            <Save size={18} />
            {saving ? 'Guardando...' : 'Confirmar datos'}
          </button>
          <button type="button" className="ghost-button" onClick={onComplete} disabled={saving}>
            <X size={18} />
            Cancelar
          </button>
        </div>
      </form>

      {showPhotoWarning && (
        <ConfirmModal
          title="Guardar sin fotos"
          message="No hay evidencia fotografica adjunta. Puedes guardar la orden, pero quedara sin respaldo visual."
          confirmText="Guardar igual"
          onCancel={() => setShowPhotoWarning(false)}
          onConfirm={() => {
            setShowPhotoWarning(false);
            saveRepair();
          }}
          disabled={saving}
        />
      )}
    </section>
  );
}

function ExpenseForm({ expenses }) {
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const filteredExpenses = useMemo(() => {
    const query = normalize(searchTerm);
    if (!query) return expenses;
    return expenses.filter((expense) => normalize(expense.concepto).includes(query));
  }, [expenses, searchTerm]);

  const resetForm = () => {
    setConcepto('');
    setMonto('');
    setEditingExpense(null);
  };

  const saveExpense = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    const now = new Date().toISOString();
    const payload = {
      concepto: concepto.trim(),
      monto: parseAmount(monto),
    };

    const response = editingExpense
      ? await supabase.from('expenses').update({ ...payload, fecha_actualizacion: now }).eq('id', editingExpense.id)
      : await supabase.from('expenses').insert({ ...payload, fecha: now });

    if (response.error) {
      setMessage(`No pude guardar el gasto: ${response.error.message}`);
    } else {
      resetForm();
    }

    setSaving(false);
  };

  const editExpense = (expense) => {
    setEditingExpense(expense);
    setConcepto(expense.concepto);
    setMonto(expense.monto);
  };

  const deleteExpense = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setMessage('');

    const { error } = await supabase.from('expenses').delete().eq('id', deleteTarget.id);
    if (error) {
      setMessage(`No se pudo eliminar el gasto: ${error.message}`);
    } else {
      setDeleteTarget(null);
    }

    setSaving(false);
  };

  return (
    <section className="view-stack">
      <ViewHeader
        title="Registro de egresos"
        subtitle="Compra de repuestos, insumos y gastos del taller."
        action={
          <div className="search-box">
            <Search size={17} />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar gasto..."
            />
          </div>
        }
      />

      {message && <SystemMessage type="error" message={message} />}

      <form className="expense-form" onSubmit={saveExpense}>
        <InputField label="Concepto" name="concepto" value={concepto} onChange={(event) => setConcepto(event.target.value)} required />
        <InputField label="Costo" name="monto" type="number" min="0" step="100" value={monto} onChange={(event) => setMonto(event.target.value)} required />
        <button type="submit" className={editingExpense ? 'warning-button' : 'danger-button'} disabled={saving}>
          {editingExpense ? <CheckCircle2 size={18} /> : <DollarSign size={18} />}
          {editingExpense ? 'Actualizar' : 'Registrar'}
        </button>
        {editingExpense && (
          <button type="button" className="ghost-button icon-only" onClick={resetForm} title="Cancelar edicion" aria-label="Cancelar edicion">
            <X size={18} />
          </button>
        )}
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Concepto</th>
              <th>Monto</th>
              <th>Actualizado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.length === 0 && (
              <tr className="empty-row">
                <td colSpan="5">
                  <EmptyState text="No hay gastos registrados." />
                </td>
              </tr>
            )}
            {filteredExpenses.map((expense) => (
              <tr key={expense.id}>
                <td data-label="Fecha">{formatDate(expense.fecha)}</td>
                <td data-label="Concepto">{expense.concepto}</td>
                <td data-label="Monto" className="negative">{formatMoney(expense.monto)}</td>
                <td data-label="Actualizado">{expense.fecha_actualizacion ? formatDate(expense.fecha_actualizacion) : 'Sin cambios'}</td>
                <td data-label="Acciones">
                  <div className="table-actions">
                    <button type="button" className="icon-link warning" onClick={() => editExpense(expense)} title="Editar" aria-label="Editar">
                      <Edit3 size={17} />
                    </button>
                    <button type="button" className="icon-link danger" onClick={() => setDeleteTarget(expense)} title="Eliminar" aria-label="Eliminar">
                      <Trash2 size={17} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Eliminar gasto"
          message={`Se eliminara el gasto "${deleteTarget.concepto}".`}
          confirmText={saving ? 'Eliminando...' : 'Eliminar'}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={deleteExpense}
          disabled={saving}
          destructive
        />
      )}
    </section>
  );
}

function InputField({ label, className = '', ...props }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}{props.required ? ' *' : ''}</span>
      <input {...props} />
    </label>
  );
}

function TextAreaField({ label, className = '', ...props }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}{props.required ? ' *' : ''}</span>
      <textarea {...props} rows="4" />
    </label>
  );
}

function SelectField({ label, options, className = '', ...props }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}{props.required ? ' *' : ''}</span>
      <select {...props}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function PatternLockField({ label, value = [], onChange, className = '' }) {
  const pattern = Array.isArray(value) ? value : [];

  const togglePoint = (point) => {
    if (pattern.includes(point)) {
      onChange(pattern.filter((p) => p !== point));
    } else {
      onChange([...pattern, point]);
    }
  };

  return (
    <div className={`field pattern-field ${className}`}>
      <div className="pattern-heading">
        <span>{label}</span>
        <button type="button" className="pattern-clear" onClick={() => onChange([])} disabled={!pattern.length}>
          Limpiar
        </button>
      </div>
      <div className="pattern-lock" aria-label="Selector de patron del equipo">
        {Array.from({ length: 9 }, (_, index) => {
          const point = index + 1;
          const order = pattern.indexOf(point) + 1;
          return (
            <button
              key={point}
              type="button"
              className={`pattern-point ${order ? 'selected' : ''}`}
              onClick={() => togglePoint(point)}
              aria-label={`Punto ${point}${order ? `, orden ${order}` : ''}`}
            >
              {order || ''}
            </button>
          );
        })}
      </div>
      <small>{pattern.length ? `Patron guardado: ${pattern.join('-')}` : 'Opcional si el equipo no tiene PIN o contrasena.'}</small>
    </div>
  );
}

function ConfirmModal({ title, message, confirmText, onCancel, onConfirm, disabled, destructive = false }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className={`modal-panel ${destructive ? 'destructive' : ''}`} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <AlertTriangle size={32} />
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        <div className="button-row">
          <button type="button" className="ghost-button" onClick={onCancel} disabled={disabled}>Cancelar</button>
          <button type="button" className={destructive ? 'danger-button' : 'warning-button'} onClick={onConfirm} disabled={disabled}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('El archivo seleccionado no es una imagen.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
      image.onload = () => {
        const maxWidth = 1200;
        const scale = Math.min(1, maxWidth / image.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('No se pudo comprimir la foto.'));
              return;
            }

            resolve({
              pending: true,
              blob,
              preview: URL.createObjectURL(blob),
              name: file.name,
            });
          },
          'image/jpeg',
          0.72,
        );
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default App;
