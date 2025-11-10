// --- DATOS DE LA APP (Lógica de negocio) ---
const dataPerifericos = {
    "Relec": ["Alternador 12v", "Alternador 24v", "Arranque 12v", "Arranque 24v"],
    "TurboTrack": ["Turbo"],
    "Nano": ["Bomba inyectora + inyectores", "Bomba inyectora", "Inyectores"],
    "Pavez": ["Inyectores", "Bomba", "Bomba + inyectores"],
    "Gongora": ["Radiador + Cooler", "Radiador", "Cooler"]
};

// --- CONFIGURACIÓN DE FIREBASE (TUS LLAVES) ---
// Adaptadas al formato 'compat' para funcionar en el navegador sin módulos.
const firebaseConfig = {
    apiKey: "AIzaSyDCLlYCyW8yLels6xVaOYrsMGTDUnCwM4A",
    authDomain: "gendiesel-perifericos.firebaseapp.com",
    projectId: "gendiesel-perifericos",
    storageBucket: "gendiesel-perifericos.firebasestorage.app",
    messagingSenderId: "304210026503",
    appId: "1:304210026503:web:7f35f16671feeb3278caa2"
};

// --- INICIALIZACIÓN DE FIREBASE ---
// La función initApp se asegura de que todo el código de la app se ejecute
// SÓLO después de que el documento HTML esté completamente cargado.
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Inicializar Firebase
        firebase.initializeApp(firebaseConfig);
        
        // Obtener una referencia a la base de datos de Firestore
        const db = firebase.firestore();

        // Llamar a la función principal para iniciar toda la lógica de la app
        initApp(db);
        
    } catch (error) {
        console.error("Error al inicializar Firebase. Revisa tus llaves y la consola:", error);
        alert("ERROR: La aplicación no pudo conectarse a Firebase. Revisa la Consola (F12).");
    }
});


// --- LÓGICA PRINCIPAL DE LA APLICACIÓN ---
function initApp(db) {

    // --- ELEMENTOS DEL DOM ---
    const tituloApp = document.getElementById('tituloApp');
    const vistas = document.querySelectorAll('.vista');
    const btnIrAEntrega = document.getElementById('btnIrAEntrega');
    const btnIrAPendientes = document.getElementById('btnIrAPendientes');
    const btnsVolverMenu = document.querySelectorAll('.btnVolverMenu');
    const ingresoForm = document.getElementById('ingresoForm');
    const servicioSelect = document.getElementById('servicio');
    const periferricoSelect = document.getElementById('periferrico');
    const listaPendientesContenedor = document.getElementById('listaPendientesContenedor');

    // --- NAVEGACIÓN ENTRE VISTAS ---

    async function mostrarVista(idVista) {
        vistas.forEach(vista => {
            vista.classList.remove('activa');
        });
        document.getElementById(idVista).classList.add('activa');
        
        // Actualizar título
        if (idVista === 'vistaMenu') {
            tituloApp.textContent = 'Menú Principal';
        } else if (idVista === 'vistaEntrega') {
            tituloApp.textContent = 'Nueva Entrega';
        } else if (idVista === 'vistaPendientes') {
            tituloApp.textContent = 'Estado de Pendientes';
            // Cargar los pendientes desde Firebase CADA VEZ que se muestra la vista
            await renderizarPendientes(db); 
        }
    }

    // Attach listeners
    if(btnIrAEntrega) btnIrAEntrega.addEventListener('click', () => mostrarVista('vistaEntrega'));
    if(btnIrAPendientes) btnIrAPendientes.addEventListener('click', () => mostrarVista('vistaPendientes'));
    
    btnsVolverMenu.forEach(btn => {
        btn.addEventListener('click', () => mostrarVista('vistaMenu'));
    });

    // --- LÓGICA DEL FORMULARIO DE ENTREGA ---

    servicioSelect.addEventListener('change', () => {
        const servicio = servicioSelect.value;
        periferricoSelect.innerHTML = '<option value="">Seleccione un tipo...</option>';
        if (servicio && dataPerifericos[servicio]) {
            periferricoSelect.disabled = false;
            dataPerifericos[servicio].forEach(periferico => {
                const option = document.createElement('option');
                option.value = periferico;
                option.textContent = periferico;
                periferricoSelect.appendChild(option);
            });
        } else {
            periferricoSelect.disabled = true;
        }
    });

    // Manejar el envío del formulario (CONECTADO A FIREBASE)
    ingresoForm.addEventListener('submit', async (evento) => {
        evento.preventDefault(); 
        const botonSubmit = evento.target.querySelector('button[type="submit"]');
        const originalText = botonSubmit.textContent;
        botonSubmit.disabled = true; 
        botonSubmit.textContent = 'Guardando en la nube...';

        // 1. Recolectar datos del formulario
        const nuevoPeriferico = {
            servicio: servicioSelect.value,
            periferico: periferricoSelect.value,
            fechaEntrega: document.getElementById('fechaEntrega').value,
            fechaRetiro: document.getElementById('fechaRetiro').value,
            centroCosto: document.getElementById('centroCosto').value,
            observaciones: document.getElementById('observaciones').value,
            estado: 'Pendiente', // Estado inicial
            // Guardamos la fecha de creación para poder ordenar
            creadoEn: firebase.firestore.FieldValue.serverTimestamp() 
        };

        try {
            // 2. Guardar en la "colección" de Firestore
            await db.collection("perifericos").add(nuevoPeriferico);

            // 3. Limpiar y volver
            // NOTA: Usamos un modal/mensaje simple en lugar de alert()
            mostrarMensaje('Éxito', '¡Periférico guardado en la nube con éxito!');
            ingresoForm.reset();
            periferricoSelect.disabled = true;
            periferricoSelect.innerHTML = '<option value="">Primero seleccione un servicio...</option>';
            mostrarVista('vistaMenu'); 
            
        } catch (error) {
            console.error("Error al guardar en Firebase: ", error);
            mostrarMensaje('Error', `Error al guardar: ${error.message}. Revisa la Consola.`);
        } finally {
            // Reactivar el botón
            botonSubmit.disabled = false;
            botonSubmit.textContent = originalText;
        }
    });
        
    // --- LÓGICA DE LA VISTA "PENDIENTES" (CONECTADA A FIREBASE) ---

    async function renderizarPendientes(db) {
        listaPendientesContenedor.innerHTML = '<p class="loading-message">Cargando periféricos pendientes desde la nube...</p>';

        try {
            // 1. Consultar a Firebase
            const querySnapshot = await db.collection("perifericos")
                .where("estado", "==", "Pendiente") // Traer solo los pendientes
                .orderBy("fechaEntrega", "asc") // Ordenar por fecha de entrega
                .get();

            // 2. Limpiar la lista
            listaPendientesContenedor.innerHTML = '';

            if (querySnapshot.empty) {
                listaPendientesContenedor.innerHTML = '<p class="empty-message">🎉 No hay periféricos pendientes de retiro. ¡Buen trabajo!</p>';
                return;
            }

            // 3. Crear una tarjeta por cada pendiente
            querySnapshot.forEach(doc => {
                const p = doc.data(); 

                const card = document.createElement('div');
                card.className = 'pendiente-card';
                
                // Formatear fechas
                const fechaEnt = p.fechaEntrega ? new Date(p.fechaEntrega + 'T00:00:00').toLocaleDateString('es-CL') : 'No definida';
                const fechaRet = p.fechaRetiro ? new Date(p.fechaRetiro + 'T00:00:00').toLocaleDateString('es-CL') : 'No definida';

                card.innerHTML = `
                    <h3>${p.periferico}</h3>
                    <p><strong>Servicio:</strong> ${p.servicio}</p>
                    <p><strong>C. Costo:</strong> ${p.centroCosto}</p>
                    <p><strong>Entrega:</strong> ${fechaEnt}</p>
                    <p><strong>Retiro Est.:</strong> ${fechaRet}</p>
                    ${p.observaciones ? `<p><strong>Obs:</strong> ${p.observaciones}</p>` : ''}
                `;
                listaPendientesContenedor.appendChild(card);
            });

        } catch (error) {
            console.error("Error al cargar pendientes: ", error);
            listaPendientesContenedor.innerHTML = '<p class="error-message">❌ Error al cargar los datos. Revisa la Consola.</p>';
        }
    }
    
    // Función simple para mostrar mensajes al usuario (reemplaza alert)
    function mostrarMensaje(titulo, cuerpo) {
        const msg = document.createElement('div');
        msg.className = 'app-message';
        msg.innerHTML = `
            <div class="message-content">
                <strong>${titulo}:</strong> ${cuerpo}
            </div>
        `;
        document.body.appendChild(msg);
        setTimeout(() => {
            msg.remove();
        }, 3000); // El mensaje desaparece después de 3 segundos
    }


    // Iniciar en el menú principal
    mostrarVista('vistaMenu');
}