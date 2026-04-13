import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBj3zHUSwSKOeNWP3lXawKBgmOagTfnAuc",
  authDomain: "transportesureste-9e2c4.firebaseapp.com",
  projectId: "transportesureste-9e2c4",
  storageBucket: "transportesureste-9e2c4.firebasestorage.app",
  messagingSenderId: "170511860621",
  appId: "1:170511860621:web:fb979213611b106f3233c4",
  measurementId: "G-L82F5PVDHC"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const sessionKey = 'transporte_sureste_session';

const views = {
  welcome: document.getElementById('view-welcome'),
  authSelect: document.getElementById('view-auth-select'),
  register: document.getElementById('view-register'),
  login: document.getElementById('view-login'),
  dashboardClient: document.getElementById('view-dashboard-client'),
  dashboardDriver: document.getElementById('view-dashboard-driver'),
  loading: document.getElementById('view-loading')
};

const buttons = {
  btnAuthStart: document.getElementById('btn-auth-start'),
  btnRegisterClient: document.getElementById('btn-register-client'),
  btnRegisterDriver: document.getElementById('btn-register-driver'),
  btnLoginClient: document.getElementById('btn-login-client'),
  btnLoginDriver: document.getElementById('btn-login-driver'),
  btnBackHome: document.getElementById('btn-back-home'),
  btnRegisterBack: document.getElementById('btn-register-back'),
  btnLoginBack: document.getElementById('btn-login-back'),
  btnResetPassword: document.getElementById('btn-reset-password'),
  btnLogout: document.getElementById('btn-logout'),
  btnLogoutDriver: document.getElementById('btn-logout-driver'),
  btnSearchRide: document.getElementById('btn-search-ride'),
  btnStartSearchDriver: document.getElementById('btn-start-search-driver'),
  btnCancelRideClient: document.getElementById('btn-cancel-ride-client'),
  btnCancelRideDriver: document.getElementById('btn-cancel-ride-driver')
};

const fields = {
  registerTitle: document.getElementById('register-title'),
  registerRole: document.getElementById('register-role'),
  registerPhone: document.getElementById('register-phone'),
  registerPassword: document.getElementById('register-password'),
  registerAge: document.getElementById('register-age'),
  registerPhoto: document.getElementById('register-photo'),
  loginTitle: document.getElementById('login-title'),
  loginRole: document.getElementById('login-role'),
  loginPhone: document.getElementById('login-phone'),
  loginPassword: document.getElementById('login-password')
};

const forms = {
  register: document.getElementById('form-register'),
  login: document.getElementById('form-login')
};

const client = {
  welcome: document.getElementById('client-welcome'),
  requestStatus: document.getElementById('client-request-status'),
  mapCard: document.getElementById('map-container-client'),
  mapElement: document.getElementById('map-client')
};

const driver = {
  welcome: document.getElementById('driver-welcome'),
  requestList: document.getElementById('driver-request-list'),
  mapCard: document.getElementById('map-container-driver'),
  mapElement: document.getElementById('map-driver')
};

let currentSession = null;
let rideListener = null;
let availableListener = null;
let mapClient = null;
let mapDriver = null;
let clientMarkers = {};
let driverMarkers = {};
let watchId = null;

const showView = (viewName) => {
  Object.values(views).forEach((section) => {
    section.classList.toggle('active', section === views[viewName]);
  });
};

const setLoading = (value) => {
  views.loading.classList.toggle('hidden', !value);
};

const buildUserId = (phone, role) => `${role}_${phone}`;
const profilePhotoFallback = 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80';

const saveSession = (session) => {
  localStorage.setItem(sessionKey, JSON.stringify(session));
  currentSession = session;
};

const clearSession = async () => {
  localStorage.removeItem(sessionKey);
  currentSession = null;
  stopWatchPosition();
  cleanupListeners();
};

const loadSession = () => {
  const data = localStorage.getItem(sessionKey);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

const createUser = async ({ phone, password, age, photo, role }) => {
  const id = buildUserId(phone, role);
  const userRef = doc(db, 'users', id);
  const snapshot = await getDoc(userRef);
  if (snapshot.exists()) {
    throw new Error('Ya existe una cuenta con ese teléfono y rol.');
  }
  await setDoc(userRef, {
    phone,
    password,
    age,
    photo: photo || profilePhotoFallback,
    role,
    createdAt: serverTimestamp()
  });
  return { id, phone, age, photo: photo || profilePhotoFallback, role };
};

const loginUser = async ({ phone, password, role }) => {
  const id = buildUserId(phone, role);
  const userRef = doc(db, 'users', id);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) {
    throw new Error('Usuario no encontrado.');
  }
  const user = snapshot.data();
  if (user.password !== password) {
    throw new Error('Contraseña incorrecta.');
  }
  return { id, ...user };
};

const showToast = (message) => {
  window.alert(message);
};

const openWhatsAppReset = () => {
  const number = '5939341266283';
  const text = encodeURIComponent('Hola, deseo restablecer mi contraseña');
  window.open(`https://wa.me/${number}?text=${text}`, '_blank');
};

const renderClientDashboard = (user) => {
  client.welcome.textContent = `Cliente: ${user.phone} · Edad ${user.age}`;
  client.requestStatus.innerHTML = '';
  client.mapCard.classList.add('hidden');
  if (mapClient) {
    mapClient.remove();
    mapClient = null;
  }
  showView('dashboardClient');
  listenClientRide(user.id);
};

const renderDriverDashboard = (user) => {
  driver.welcome.textContent = `Chofer: ${user.phone} · Edad ${user.age}`;
  driver.requestList.innerHTML = '';
  driver.mapCard.classList.add('hidden');
  if (mapDriver) {
    mapDriver.remove();
    mapDriver = null;
  }
  showView('dashboardDriver');
  subscribeAvailableRequests();
  listenDriverRide(user.id);
};

const cleanupListeners = () => {
  if (rideListener) {
    rideListener();
    rideListener = null;
  }
  if (availableListener) {
    availableListener();
    availableListener = null;
  }
};

const listenClientRide = async (clientId) => {
  cleanupListeners();
  const ridesRef = collection(db, 'rides');
  const q = query(ridesRef, where('clientId', '==', clientId), orderBy('createdAt', 'desc'));
  rideListener = onSnapshot(q, (snapshot) => {
    const ride = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))[0];
    if (!ride) {
      client.requestStatus.innerHTML = '<p>Presiona "Buscar servicio" para enviar tu ubicación y recibir choferes disponibles.</p>';
      client.mapCard.classList.add('hidden');
      stopWatchPosition();
      return;
    }
    renderClientRide(ride);
  });
};

const renderClientRide = async (ride) => {
  const statusText = ride.status === 'open'
    ? 'Buscando chofer disponible...'
    : ride.status === 'accepted'
      ? `Chofer asignado: ${ride.driverPhone}`
      : 'Servicio cancelado';

  const content = [`<strong>${statusText}</strong>`];
  content.push(`<p>Cliente: ${ride.clientPhone} · Edad ${ride.clientAge}</p>`);
  if (ride.status === 'accepted') {
    content.push(`<p>Chofer: ${ride.driverPhone} · Edad ${ride.driverAge}</p>`);
  }
  client.requestStatus.innerHTML = content.join('');

  if (ride.status === 'accepted') {
    client.mapCard.classList.remove('hidden');
    initClientMap(ride);
  } else {
    client.mapCard.classList.add('hidden');
  }
};

const renderAvailableRequests = (rides) => {
  driver.requestList.innerHTML = '';
  if (!rides.length) {
    driver.requestList.innerHTML = '<p>No hay clientes disponibles en este momento.</p>';
    return;
  }
  rides.forEach((ride) => {
    const item = document.createElement('div');
    item.className = 'request-card';
    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;">
        <img src="${ride.clientPhoto}" alt="Foto cliente" />
        <div>
          <strong>Cliente ${ride.clientPhone}</strong>
          <span>Edad ${ride.clientAge}</span>
        </div>
      </div>
      <p>Ubicación: ${ride.location?.description || 'Coordenadas registradas'}</p>
      <button data-id="${ride.id}" class="btn-accept">Aceptar servicio</button>
    `;
    driver.requestList.appendChild(item);
  });
  document.querySelectorAll('.btn-accept').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const rideId = event.currentTarget.dataset.id;
      acceptRide(rideId);
    });
  });
};

const listenDriverRide = async (driverId) => {
  const ridesRef = collection(db, 'rides');
  const q = query(ridesRef, where('driverId', '==', driverId), orderBy('createdAt', 'desc'));
  rideListener = onSnapshot(q, (snapshot) => {
    const ride = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))[0];
    if (!ride) {
      return;
    }
    renderDriverRide(ride);
  });
};

const renderDriverRide = async (ride) => {
  if (ride.status !== 'accepted') {
    driver.mapCard.classList.add('hidden');
    return;
  }
  driver.mapCard.classList.remove('hidden');
  if (!mapDriver) {
    initDriverMap(ride);
  } else {
    updateRideMap(ride, mapDriver, driverMarkers, clientMarkers);
  }
};

const acceptRide = async (rideId) => {
  if (!currentSession) return;
  const rideRef = doc(db, 'rides', rideId);
  const driverSnapshot = await getDoc(doc(db, 'users', currentSession.id));
  if (!driverSnapshot.exists()) return;
  const driverData = driverSnapshot.data();
  await updateDoc(rideRef, {
    status: 'accepted',
    driverId: currentSession.id,
    driverPhone: driverData.phone,
    driverAge: driverData.age,
    driverPhoto: driverData.photo,
    acceptedAt: serverTimestamp()
  });
  if (navigator.geolocation) {
    startWatchDriverPosition(rideId);
  }
};

const startWatchDriverPosition = (rideId) => {
  if (!navigator.geolocation) return;
  stopWatchPosition();
  watchId = navigator.geolocation.watchPosition(async (position) => {
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      driverLocation: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        updatedAt: serverTimestamp()
      }
    });
  }, console.error, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
};

const stopWatchPosition = () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
};

const initClientMap = (ride) => {
  if (!mapClient) {
    mapClient = L.map('map-client').setView([ride.clientLocation.lat, ride.clientLocation.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapClient);
    clientMarkers = {};
  }
  updateRideMap(ride, mapClient, clientMarkers, driverMarkers);
};

const initDriverMap = (ride) => {
  const center = ride.driverLocation?.lat ? [ride.driverLocation.lat, ride.driverLocation.lng] : [ride.clientLocation.lat, ride.clientLocation.lng];
  mapDriver = L.map('map-driver').setView(center, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(mapDriver);
  clientMarkers = {};
  driverMarkers = {};
  updateRideMap(ride, mapDriver, driverMarkers, clientMarkers);
};

const updateRideMap = (ride, mapInstance, ownMarkers, otherMarkers) => {
  const positions = [];
  if (ride.driverLocation?.lat) {
    positions.push([ride.driverLocation.lat, ride.driverLocation.lng]);
    if (!ownMarkers.driver) {
      ownMarkers.driver = L.marker([ride.driverLocation.lat, ride.driverLocation.lng], { title: 'Chofer' }).addTo(mapInstance).bindPopup('Chofer');
    } else {
      ownMarkers.driver.setLatLng([ride.driverLocation.lat, ride.driverLocation.lng]);
    }
  }
  if (ride.clientLocation?.lat) {
    positions.push([ride.clientLocation.lat, ride.clientLocation.lng]);
    if (!otherMarkers.client) {
      otherMarkers.client = L.marker([ride.clientLocation.lat, ride.clientLocation.lng], { title: 'Cliente' }).addTo(mapInstance).bindPopup('Cliente');
    } else {
      otherMarkers.client.setLatLng([ride.clientLocation.lat, ride.clientLocation.lng]);
    }
  }
  if (positions.length) {
    const bounds = L.latLngBounds(positions);
    mapInstance.fitBounds(bounds.pad(0.3));
  }
};

const createRideRequest = async () => {
  if (!currentSession) return;
  if (!navigator.geolocation) {
    showToast('Tu navegador no puede obtener ubicación.');
    return;
  }
  setLoading(true);
  navigator.geolocation.getCurrentPosition(async (position) => {
    try {
      const userSnapshot = await getDoc(doc(db, 'users', currentSession.id));
      const user = userSnapshot.data();
      await addDoc(collection(db, 'rides'), {
        clientId: currentSession.id,
        clientPhone: user.phone,
        clientAge: user.age,
        clientPhoto: user.photo,
        status: 'open',
        location: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          description: 'Ubicación en tiempo real',
          accuracy: position.coords.accuracy
        },
        clientLocation: {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        },
        createdAt: serverTimestamp()
      });
      showToast('Solicitud enviada. Espera a que un chofer la acepte.');
    } catch (error) {
      showToast(error.message);
    } finally {
      setLoading(false);
    }
  }, (error) => {
    setLoading(false);
    showToast('Error al obtener ubicación: ' + error.message);
  }, { enableHighAccuracy: true, timeout: 15000 });
};

const subscribeAvailableRequests = () => {
  cleanupListeners();
  const ridesRef = collection(db, 'rides');
  const q = query(ridesRef, where('status', '==', 'open'), orderBy('createdAt', 'desc'));
  availableListener = onSnapshot(q, (snapshot) => {
    const rides = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderAvailableRequests(rides);
  });
};

const cancelRide = async () => {
  if (!currentSession) return;
  const ridesRef = collection(db, 'rides');
  const q = query(ridesRef, where('status', 'in', ['open', 'accepted']), where(currentSession.role === 'client' ? 'clientId' : 'driverId', '==', currentSession.id));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    for (const docSnap of snapshot.docs) {
      await updateDoc(doc(db, 'rides', docSnap.id), { status: 'cancelled' });
    }
  }
  if (currentSession.role === 'driver') {
    driver.mapCard.classList.add('hidden');
  } else {
    client.mapCard.classList.add('hidden');
  }
  showToast('Servicio cancelado.');
};

const submitRegister = async (event) => {
  event.preventDefault();
  const phone = fields.registerPhone.value.trim();
  const password = fields.registerPassword.value;
  const age = Number(fields.registerAge.value);
  const photo = fields.registerPhoto.value.trim();
  const role = fields.registerRole.value;
  if (!phone || !password || !age) {
    showToast('Completa todos los datos.');
    return;
  }
  setLoading(true);
  try {
    const user = await createUser({ phone, password, age, photo, role });
    saveSession({ id: user.id, role: user.role });
    showToast('Cuenta creada con éxito.');
    if (role === 'client') {
      renderClientDashboard(user);
    } else {
      renderDriverDashboard(user);
    }
  } catch (error) {
    showToast(error.message);
  } finally {
    setLoading(false);
  }
};

const submitLogin = async (event) => {
  event.preventDefault();
  const phone = fields.loginPhone.value.trim();
  const password = fields.loginPassword.value;
  const role = fields.loginRole.value;
  if (!phone || !password) {
    showToast('Completa todos los datos.');
    return;
  }
  setLoading(true);
  try {
    const user = await loginUser({ phone, password, role });
    saveSession({ id: user.id, role: user.role });
    showToast('Bienvenido de nuevo.');
    if (role === 'client') {
      renderClientDashboard(user);
    } else {
      renderDriverDashboard(user);
    }
  } catch (error) {
    showToast(error.message);
  } finally {
    setLoading(false);
  }
};

buttons.btnAuthStart.addEventListener('click', () => showView('authSelect'));
buttons.btnRegisterClient.addEventListener('click', () => {
  fields.registerTitle.textContent = 'Crear cuenta como Cliente';
  fields.registerRole.value = 'client';
  showView('register');
});
buttons.btnRegisterDriver.addEventListener('click', () => {
  fields.registerTitle.textContent = 'Crear cuenta como Chofer';
  fields.registerRole.value = 'driver';
  showView('register');
});
buttons.btnLoginClient.addEventListener('click', () => {
  fields.loginTitle.textContent = 'Iniciar sesión Cliente';
  fields.loginRole.value = 'client';
  showView('login');
});
buttons.btnLoginDriver.addEventListener('click', () => {
  fields.loginTitle.textContent = 'Iniciar sesión Chofer';
  fields.loginRole.value = 'driver';
  showView('login');
});
buttons.btnBackHome.addEventListener('click', () => showView('welcome'));
buttons.btnRegisterBack.addEventListener('click', () => showView('authSelect'));
buttons.btnLoginBack.addEventListener('click', () => showView('authSelect'));
buttons.btnResetPassword.addEventListener('click', openWhatsAppReset);
buttons.btnLogout.addEventListener('click', async () => {
  await clearSession();
  showView('welcome');
});
buttons.btnLogoutDriver.addEventListener('click', async () => {
  await clearSession();
  showView('welcome');
});
buttons.btnSearchRide.addEventListener('click', createRideRequest);
buttons.btnStartSearchDriver.addEventListener('click', subscribeAvailableRequests);
buttons.btnCancelRideClient.addEventListener('click', cancelRide);
buttons.btnCancelRideDriver.addEventListener('click', cancelRide);
forms.register.addEventListener('submit', submitRegister);
forms.login.addEventListener('submit', submitLogin);

const initialize = async () => {
  const session = loadSession();
  if (!session) {
    return showView('welcome');
  }
  setLoading(true);
  try {
    const userSnapshot = await getDoc(doc(db, 'users', session.id));
    if (!userSnapshot.exists()) {
      await clearSession();
      return showView('welcome');
    }
    const user = { id: session.id, ...userSnapshot.data() };
    currentSession = session;
    if (session.role === 'client') {
      renderClientDashboard(user);
    } else {
      renderDriverDashboard(user);
    }
  } catch (error) {
    console.error(error);
    await clearSession();
    showView('welcome');
  } finally {
    setLoading(false);
  }
};

initialize();
