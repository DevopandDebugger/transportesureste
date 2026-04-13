# Transporte Sureste - App web estática

Esta aplicación es un prototipo de transporte tipo Uber usando solo archivos estáticos y Firebase.

## Archivos

- `index.html`: interfaz principal y vistas para clientes / choferes.
- `styles.css`: estilos para diseño responsivo y componentes.
- `app.js`: lógica de autenticación, sesión, búsqueda de rutas, Firebase y mapas.

## Cómo usar

1. Crear un proyecto de Firebase en https://console.firebase.google.com
2. Agregar una aplicación web en el proyecto.
3. Copiar las credenciales del objeto `firebaseConfig` y pegarlas en `app.js`.
4. Habilitar Firestore Database en modo de prueba o con reglas que permitan lectura/escritura seguras.

## Flujo

- El usuario elige crear cuenta o iniciar sesión.
- El cliente registra su teléfono, edad, foto y contraseña.
- El chofer registra su teléfono, edad, foto y contraseña.
- Los inicios de sesión se guardan en `localStorage` para mantener sesión activa.
- El cliente puede buscar transporte y publicar su ubicación.
- Los choferes ven clientes disponibles y aceptan solicitudes.
- Al aceptar, se abre un mapa en tiempo real con posición del chofer y del cliente.
- Ambos pueden cancelar el servicio.

## Nota

- Reemplaza los valores de `firebaseConfig` en `app.js` antes de publicar en GitHub.
- El enlace de restablecer contraseña abre WhatsApp con el número `9341266283`.
