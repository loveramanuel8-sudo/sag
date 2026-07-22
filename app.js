/**
 * Prize Fitosanitario - Core Application Logic
 * Pair Programming: Antigravity Team & Exportadora Prize
 * 
 * Manages states, Web Audio API sound synthesis, 3D/2D visual rendering,
 * spatial box models, and step transitions for SAG inspections.
 */

// --- Sound Synthesizer Class (Web Audio API) ---
class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playBeep() {
        if (!this.enabled) return;
        this.init();
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(950, this.ctx.currentTime); // High pitch beep
        
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.13);
    }

    playBuzzer() {
        if (!this.enabled) return;
        this.init();
        
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(140, this.ctx.currentTime); // Low grating pitch
        
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(143, this.ctx.currentTime); // Detuned frequency for beats
        
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.65);
        
        osc1.start();
        osc2.start();
        osc1.stop(this.ctx.currentTime + 0.65);
        osc2.stop(this.ctx.currentTime + 0.65);
    }
}

// --- App State Definition ---
const AppState = {
    activeStep: 1,
    soundManager: new SoundManager(),
    activeFolio: null,
    activePackingList: null,
    packingListApproved: false,
    
    // SAP Pallet Inspection parameters
    sapPalletSample: [], // e.g. ['1020013265', '1020013267']
    palletStates: {},    // e.g. { '1020013265': 'pending', '1020013267': 'pending' }
    completedPalletInspections: {}, // e.g. { '1020013265': { boxes: [...], dictamen: 'APROBADO' } }

    // Captured faces (Step 3)
    capturedFaces: {
        A: false,
        B: false,
        C: false,
        D: false
    },
    
    // Conteo & Cuadratura (Step 3)
    physicalBoxCount: 0,
    cuadraturaCompleted: false,
    cuadraturaAdjusted: false,

    // Step 4 state
    overlayDetectionsGenerated: false,
    
    // Boxes database for the current pallet
    boxes: [], // Will store all 184 box models of the current activeFolio
    
    // Inspector Selection (Step 5)
    inspectorActiveFace: 'A',
    selectedBoxId: null,
    blindLevelSelected: null,
    blindBoxSelectedId: null,
    
    // Physical Inspection (Step 6)
    currentExtractionIndex: 0,
    scannedVerificationError: false
};

// --- Mock Database for Packing Lists (ERP/WMS) ---
const PackingListMockData = {
    'solicitud_5344': {
        solicitudNo: '5344',
        lote: 'LOT-5344-SAG',
        planta: 'PRIZE PROSERVICE',
        csp: '105634',
        kilos: '18.710,00',
        cajas: 4128,
        pallets: 21,
        especie: 'CEREZAS',
        destinos: 'CHINA, HONG KONG, UNIÓN EUROPEA',
        sapMuestra: ['1020006982', '1020007001', '0040027622'], // Fallback defaults
        fecha: '22-07-2026',
        productores: [
            { especie: 'CEREZAS', csg: '87604', proceso: '20726, 20722', nombre: 'AGRO DITZLER LTDA', cajas: 127 },
            { especie: 'CEREZAS', csg: '169933', proceso: '20779, 20782, 20724, 20734, 20811', nombre: 'AGROINVEST LA POZA', cajas: 2210 },
            { especie: 'CEREZAS', csg: '169489', proceso: '20780, 20739, 20788, 20789, 20781', nombre: 'AGROINVEST CANCURA', cajas: 1679 },
            { especie: 'CEREZAS', csg: '110312', proceso: '20737, 20725, 20766, 20756', nombre: 'HERMAN CRISTIAN HOGER CID', cajas: 112 }
        ],
        palletsList: [
            { id: 1, folio: '0040027562', csg: '169933', productor: 'AGROINVEST LA POZA', cajas: 176 },
            { id: 2, folio: '0040027564', csg: '169933', productor: 'AGROINVEST LA POZA', cajas: 176 },
            { id: 3, folio: '0040027591', csg: '169933', productor: 'AGROINVEST LA POZA', cajas: 176 },
            { id: 4, folio: '0040027597', csg: '169933', productor: 'AGROINVEST LA POZA', cajas: 176 },
            { id: 5, folio: '0040027601', csg: '169933', productor: 'AGROINVEST LA POZA', cajas: 176 },
            { id: 6, folio: '0040027622', csg: '169933', productor: 'AGROINVEST LA POZA', cajas: 176, defaultChecked: true },
            { id: 7, folio: '1020006982', csg: '169933', productor: 'AGROINVEST LA POZA', cajas: 384, defaultChecked: true },
            { id: 8, folio: '1020006983', csg: '169933', productor: 'AGROINVEST LA POZA', cajas: 384 },
            { id: 9, folio: '1020006986', csg: '169489', productor: 'AGROINVEST CANCURA', cajas: 176 },
            { id: 10, folio: '1020006987', csg: '169489', productor: 'AGROINVEST CANCURA', cajas: 176 },
            { id: 11, folio: '1020006989', csg: '169489', productor: 'AGROINVEST CANCURA', cajas: 176 },
            { id: 12, folio: '1020006991', csg: '169489', productor: 'AGROINVEST CANCURA', cajas: 176 },
            { id: 13, folio: '1020006992', csg: '169489', productor: 'AGROINVEST CANCURA', cajas: 176 },
            { id: 14, folio: '1020006995', csg: '169489', productor: 'AGROINVEST CANCURA', cajas: 176 },
            { id: 15, folio: '1020006996', csg: '169489', productor: 'AGROINVEST CANCURA', cajas: 176 },
            { id: 16, folio: '1020006997', csg: '169489', productor: 'AGROINVEST CANCURA', cajas: 176 },
            { id: 17, folio: '1020006999', csg: '169489', productor: 'AGROINVEST CANCURA', cajas: 176 },
            { id: 18, folio: '1020007000', csg: '169489', productor: 'AGROINVEST CANCURA', cajas: 176 },
            { id: 19, folio: '1020007001', csg: '110312', productor: 'HERMAN CRISTIAN HOGER CID', cajas: 184, defaultChecked: true },
            { id: 20, folio: '1020007002', csg: '169489', productor: 'AGROINVEST CANCURA', cajas: 184 },
            { id: 21, folio: '1020007004', csg: '169933', productor: 'AGROINVEST LA POZA', cajas: 176 }
        ]
    },
    'solicitud_5345_error': {
        solicitudNo: '5345',
        lote: 'LOT-5345-SAG-ERR',
        planta: 'PRIZE CSP 2',
        csp: '105699',
        kilos: '15.840,00',
        cajas: 3248,
        pallets: 18,
        especie: 'CEREZAS',
        destinos: 'CHINA, TAIWÁN',
        sapMuestra: ['1020006903', '1020006915'], // Fallback defaults
        fecha: '21-07-2026',
        productores: [
            { especie: 'CEREZAS', csg: '169933', proceso: '20724, 20772, 20773', nombre: 'AGROINVEST LA POZA', cajas: 1840 },
            { especie: 'CEREZAS', csg: '169489', proceso: '20780, 20739, 20788', nombre: 'AGROINVEST CANCURA', cajas: 1408 }
        ],
        palletsList: [
            { id: 1, folio: '1020006901', csg: '169933', productor: 'AGROINVEST LA POZA', cajas: 184 },
            { id: 2, folio: '1020006902', csg: '169933', productor: 'AGROINVEST LA POZA', cajas: 184 },
            { id: 3, folio: '1020006903', csg: '169933', productor: 'AGROINVEST LA POZA', cajas: 184, defaultChecked: true },
            { id: 4, folio: '1020006904', csg: '169933', productor: 'AGROINVEST LA POZA', cajas: 184 },
            { id: 5, folio: '1020006905', csg: '169933', productor: 'AGROINVEST LA POZA', cajas: 184 },
            { id: 6, folio: '1020006906', csg: '169933', productor: 'AGROINVEST LA POZA', cajas: 184 },
            { id: 7, folio: '1020006907', csg: '169933', productor: 'AGROINVEST LA POZA', cajas: 184 },
            { id: 8, folio: '1020006908', csg: '169933', productor: 'AGROINVEST LA POZA', cajas: 184 },
            { id: 9, folio: '1020006909', csg: '169933', productor: 'AGROINVEST LA POZA', cajas: 184 },
            { id: 10, folio: '1020006910', csg: '169933', productor: 'AGROINVEST LA POZA', cajas: 184 },
            { id: 11, folio: '1020006911', csg: '169489', productor: 'AGROINVEST CANCURA', cajas: 176 },
            { id: 12, folio: '1020006912', csg: '169489', productor: 'AGROINVEST CANCURA', cajas: 176 },
            { id: 13, folio: '1020006913', csg: '169489', productor: 'AGROINVEST CANCURA', cajas: 176 },
            { id: 14, folio: '1020006914', csg: '169489', productor: 'AGROINVEST CANCURA', cajas: 176 },
            { id: 15, folio: '1020006915', csg: '169489', productor: 'AGROINVEST CANCURA', cajas: 176, defaultChecked: true },
            { id: 16, folio: '1020006916', csg: '169489', productor: 'AGROINVEST CANCURA', cajas: 176 },
            { id: 17, folio: '1020006917', csg: '169489', productor: 'AGROINVEST CANCURA', cajas: 176 },
            { id: 18, folio: '1020006918', csg: '169489', productor: 'AGROINVEST CANCURA', cajas: 176 }
        ]
    }
};

// --- Box Layout Model Generator ---
function generatePalletBoxes(folio, packingListName) {
    const boxes = [];
    
    // 12 Levels total (11 levels if folio is 0040027622 to get 176 boxes)
    let maxLevel = 12;
    if (folio === '0040027622') {
        maxLevel = 11; // 176 boxes total
    }
    
    const faces = ['A', 'B', 'C', 'D'];
    let boxIndex = 1;
    
    // Outer perimeter mapping
    for (let level = 1; level <= maxLevel; level++) {
        const levelStr = String(level).padStart(2, '0');
        
        // 1. Generate Exterior Boxes (Faces A, B, C, D - Columns C1, C2)
        faces.forEach(face => {
            for (let col = 1; col <= 2; col++) {
                const boxId = `N${levelStr}-${face}-C${col}`;
                
                // Generate a 10-digit Box Number based on the folio (e.g. folio: 1020013265)
                // We take first 7 digits of folio (1020013) and append the 3-digit padded box index (001 to 184)
                const boxIndexStr = String(boxIndex).padStart(3, '0');
                const boxCode = `69${folio.slice(2, 7)}${boxIndexStr}`;
                boxIndex++;
                
                // Determine if this box is obstructed by a zuncho green strap
                // Zuncho 1 (level 3), Zuncho 2 (level 5), Zuncho 3 (level 8), Zuncho 4 (level 10)
                let isObstructed = false;
                if (level === 3 && face === 'A' && col === 1) isObstructed = true;
                if (level === 5 && face === 'B' && col === 2) isObstructed = true;
                if (level === 8 && face === 'A' && col === 2) isObstructed = true; // Key example from prompt
                if (level === 10 && face === 'D' && col === 1) isObstructed = true;
                
                boxes.push({
                    id: boxId,
                    level: level,
                    face: face,
                    column: col,
                    type: 'exterior',
                    boxCode: boxCode,
                    dataMatrix: boxCode, // Data Matrix decodes directly to the 10-digit code!
                    status: 'unselected', // 'unselected', 'suggested', 'selected', 'approved', 'rejected'
                    obstructedByZuncho: isObstructed,
                    manualReadConfirmed: false,
                    evalState: null // 'APPROVED', 'REJECTED'
                });
            }
        });
        
        // 2. Generate Interior Boxes (only levels 1 to 11)
        if (level < 12) {
            for (let coreIdx = 1; coreIdx <= 8; coreIdx++) {
                const boxId = `N${levelStr}-INT${coreIdx}`;
                const boxIndexStr = String(boxIndex).padStart(3, '0');
                const boxCode = `69${folio.slice(2, 7)}${boxIndexStr}`;
                boxIndex++;
                
                boxes.push({
                    id: boxId,
                    level: level,
                    face: 'INT',
                    column: coreIdx,
                    type: 'interior',
                    boxCode: boxCode,
                    dataMatrix: boxCode,
                    status: 'unselected',
                    obstructedByZuncho: false,
                    manualReadConfirmed: false,
                    evalState: null
                });
            }
        }
    }
    
    // 3. Algorithmic SAG Suggestions (Marco Verde)
    // Select 4 random exterior boxes to pre-suggest
    // (Ensure they are spread across different levels/faces)
    const suggestedIndexes = [
        boxes.findIndex(b => b.level === 4 && b.face === 'A' && b.column === 1),
        boxes.findIndex(b => b.level === 7 && b.face === 'B' && b.column === 2),
        boxes.findIndex(b => b.level === 11 && b.face === 'C' && b.column === 1),
        boxes.findIndex(b => b.level === 2 && b.face === 'D' && b.column === 2)
    ];
    
    suggestedIndexes.forEach(idx => {
        if (idx !== -1) {
            boxes[idx].status = 'suggested';
        }
    });
    
    return boxes;
}

// --- Blocking Layout logic for interior boxes disassembly ---
// Maps each interior box index to blocking exterior boxes at the same level
const InteriorBlockingMatrix = {
    1: { face: 'A', cols: [1], description: 'Caja frontal izquierda' },
    2: { face: 'A', cols: [2], description: 'Caja frontal derecha' },
    3: { face: 'B', cols: [1], description: 'Caja lateral derecha frontal' },
    4: { face: 'B', cols: [2], description: 'Caja lateral derecha posterior' },
    5: { face: 'C', cols: [1], description: 'Caja posterior derecha' },
    6: { face: 'C', cols: [2], description: 'Caja posterior izquierda' },
    7: { face: 'D', cols: [1], description: 'Caja lateral izquierda posterior' },
    8: { face: 'D', cols: [2], description: 'Caja lateral izquierda frontal' }
};

// --- CORE APP CLASS ---
class AppController {
    constructor() {
        this.state = AppState;
    }

    // Initialize application
    init() {
        this.setStep(1);
        this.updateLockStatus();
        this.logConsole("Sistema cargado. Por favor seleccione un Packing List en la estación 01.");
    }

    // Step navigation control
    setStep(stepNum) {
        // Enforce validations to prevent moving ahead illegally (except step 7 History)
        if (stepNum !== 7) {
            if (stepNum > 1 && !this.state.packingListApproved) {
                this.alertNoPermission("Debe aprobar y habilitar el Packing List por la Contraparte SAG en el Paso 1.");
                return;
            }
            if (stepNum > 2 && !this.state.activeFolio) {
                this.alertNoPermission("El tarjador debe pistolear y validar el folio del pallet en el Paso 2.");
                return;
            }
            if (stepNum > 3 && !this.state.cuadraturaCompleted) {
                this.alertNoPermission("Debe completar la toma de fotos de las 4 caras y cuadrar el lote en el Paso 3.");
                return;
            }
            if (stepNum > 4 && !this.state.overlayDetectionsGenerated) {
                this.alertNoPermission("Debe ejecutar el Motor de Visión e IA en el Paso 4 para decodificar las etiquetas.");
                return;
            }
            if (stepNum > 5) {
                // Count selected samples
                const selected = this.state.boxes.filter(b => b.status === 'selected' || b.status === 'approved' || b.status === 'rejected');
                if (selected.length < 4) {
                    this.alertNoPermission("El Inspector SAG debe seleccionar al menos 4 cajas en la tablet para muestrear (Paso 5) antes de proceder.");
                    return;
                }
            }
        }

        // Change step
        this.state.activeStep = stepNum;
        
        // Update sidebar UI classes
        for (let i = 1; i <= 7; i++) {
            const btn = document.getElementById(`btn-step-${i}`);
            if (btn) {
                if (i === stepNum) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        }

        // Show corresponding section
        document.querySelectorAll('.step-view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`view-step-${stepNum}`).classList.add('active');

        // Execute specific view entry hooks
        this.onViewEnter(stepNum);
    }

    onViewEnter(stepNum) {
        this.updateLockStatus();
        if (stepNum === 2) {
            document.getElementById('input-barcode').focus();
        } else if (stepNum === 4) {
            this.simulateNeuralProcess();
        } else if (stepNum === 5) {
            this.loadInspectorPalletView();
        } else if (stepNum === 6) {
            this.loadPhysicalVerificationView();
        } else if (stepNum === 7) {
            this.loadHistoryView();
        }
    }

    alertNoPermission(msg) {
        this.state.soundManager.playBuzzer();
        alert(`⚠ ACCESO RESTRINGIDO\n\n${msg}`);
    }

    // Audio Toggle
    toggleSound() {
        this.state.soundManager.enabled = !this.state.soundManager.enabled;
        const btn = document.getElementById('sound-btn');
        if (this.state.soundManager.enabled) {
            btn.classList.remove('muted');
            btn.querySelector('span').innerText = "Audio Habilitado";
            this.state.soundManager.playBeep();
        } else {
            btn.classList.add('muted');
            btn.querySelector('span').innerText = "Audio Silenciado";
        }
    }

    // STEP 1 LOGIC: CONTRAPARTE SAG
    loadPackingListData(key) {
        const preview = document.getElementById('plist-preview-container');
        const btnApprove = document.getElementById('btn-approve-plist');
        const accordion = document.getElementById('plist-boxes-accordion');
        const listContainer = document.getElementById('plist-boxes-list');
        
        if (!key) {
            preview.style.display = 'none';
            accordion.style.display = 'none';
            btnApprove.disabled = true;
            return;
        }

        const data = PackingListMockData[key];
        this.state.activePackingList = { name: key, ...data };

        // Populate Solicitud table details
        document.getElementById('td-solic-no').innerText = data.solicitudNo;
        document.getElementById('td-planta').innerText = data.planta;
        document.getElementById('td-csp').innerText = data.csp;
        document.getElementById('td-cajas-dec').innerText = data.cajas.toLocaleString();
        document.getElementById('td-kilos').innerText = data.kilos;
        document.getElementById('td-pallets-dec').innerText = data.pallets;
        document.getElementById('td-destinos').innerText = data.destinos;
        document.getElementById('td-fecha').innerText = data.fecha;
        document.getElementById('td-pallets-sap').innerText = data.sapMuestra.join(', ');

        // Populate Pallets table with checkboxes and presence statuses
        const tbodyPallets = document.getElementById('td-pallets-list-tbody');
        tbodyPallets.innerHTML = '';
        
        this.state.verifiedPallets = {};
        const pallets = data.palletsList || [];
        pallets.forEach(p => {
            this.state.verifiedPallets[p.folio] = false;
            
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--color-border)';
            tr.id = `pallet-row-${p.folio}`;
            
            tr.innerHTML = `
                <td style="padding:8px; text-align:center;">
                    <input type="checkbox" class="sample-pallet-chk" id="chk-${p.folio}" data-folio="${p.folio}" data-default-checked="${p.defaultChecked ? 'true' : 'false'}" disabled onchange="app.updateSelectedPalletsMuestra()" style="transform: scale(1.1); cursor:pointer;">
                </td>
                <td style="padding:8px; font-size:0.8rem;">${p.id}</td>
                <td style="padding:8px; font-family:var(--font-mono); font-size:0.8rem; font-weight:700; color:var(--color-accent-sag);">${p.folio}</td>
                <td style="padding:8px; font-size:0.8rem;">
                    <span class="badge-item-status pending" id="presence-${p.folio}" style="padding: 2px 6px; font-size:0.75rem;">❌ Ausente</span>
                </td>
                <td style="padding:8px; font-family:var(--font-mono); font-size:0.8rem;">${p.csg}</td>
                <td style="padding:8px; font-size:0.8rem;">${p.productor}</td>
                <td style="padding:8px; text-align:right; font-family:var(--font-mono); font-size:0.8rem; font-weight:700;">${p.cajas}</td>
            `;
            tbodyPallets.appendChild(tr);
        });

        // Populate Productores Summary table
        const tbodyProductores = document.getElementById('td-productores-summary-tbody');
        if (tbodyProductores) {
            tbodyProductores.innerHTML = '';
            const productores = data.productores || [];
            productores.forEach(prod => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--color-border)';
                tr.innerHTML = `
                    <td style="padding:8px; font-family:var(--font-mono); font-size:0.8rem; font-weight:700; color:var(--color-accent-sag);">${prod.csg}</td>
                    <td style="padding:8px; font-size:0.8rem;">${prod.nombre}</td>
                    <td style="padding:8px; text-align:right; font-family:var(--font-mono); font-size:0.8rem; font-weight:700;">${prod.cajas.toLocaleString()}</td>
                `;
                tbodyProductores.appendChild(tr);
            });
        }

        // Initialize display of selected pallets (none initially until checked in)
        document.getElementById('td-pallets-sap').innerText = 'Ninguno (Escanee pallets para verificar presencia)';
        listContainer.innerHTML = '<div class="text-center text-muted p-md" style="font-size:0.85rem;">Escanee y verifique pallets físicamente para habilitar su listado de cajas.</div>';

        preview.style.display = 'block';
        accordion.style.display = 'block';
        
        // Disable approve button initially
        if (btnApprove) btnApprove.disabled = true;

        this.state.soundManager.playBeep();
        this.logConsole(`Cargada planilla de lote ERP: ${data.lote}. Total ${data.pallets} pallets. Realice la verificación física escaneando los códigos de barra.`);
    }

    updateSelectedPalletsMuestra(isInitial = false) {
        const checkboxes = document.querySelectorAll('.sample-pallet-chk');
        const selectedFolios = [];
        checkboxes.forEach(chk => {
            if (chk.checked) {
                selectedFolios.push(chk.dataset.folio);
            }
        });

        // Update the display field of SAP sample folios in Step 1
        document.getElementById('td-pallets-sap').innerText = selectedFolios.length > 0 ? selectedFolios.join(', ') : 'Ninguno';

        // Populate step 1 boxes accordion for ONLY the checked folios
        const listContainer = document.getElementById('plist-boxes-list');
        listContainer.innerHTML = '';
        
        if (this.state.activePackingList) {
            const key = this.state.activePackingList.name;
            selectedFolios.forEach(folio => {
                const tempBoxes = generatePalletBoxes(folio, key);
                
                const groupDiv = document.createElement('div');
                groupDiv.style.background = 'var(--color-bg-card-hover)';
                groupDiv.style.border = '1px solid var(--color-border)';
                groupDiv.style.borderRadius = 'var(--radius-sm)';
                groupDiv.style.padding = '0.75rem';
                groupDiv.style.marginTop = '0.75rem';

                const headerDiv = document.createElement('div');
                headerDiv.style.display = 'flex';
                headerDiv.style.justifyContent = 'space-between';
                headerDiv.style.alignItems = 'center';
                headerDiv.style.fontWeight = '700';
                headerDiv.style.fontSize = '0.9rem';
                headerDiv.style.color = 'var(--color-primary)';
                headerDiv.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                headerDiv.style.paddingBottom = '0.4rem';
                headerDiv.innerHTML = `
                    <span>📦 Pallet Folio: <span class="font-mono text-bold text-accent" style="letter-spacing:0.5px;">${folio}</span></span>
                    <span class="font-mono text-bold text-accent">${tempBoxes.length} Cajas</span>
                `;

                const gridDiv = document.createElement('div');
                gridDiv.style.display = 'flex';
                gridDiv.style.flexWrap = 'wrap';
                gridDiv.style.gap = '6px';
                gridDiv.style.marginTop = '0.5rem';
                gridDiv.style.maxHeight = '140px';
                gridDiv.style.overflowY = 'auto';
                gridDiv.style.paddingRight = '4px';

                tempBoxes.forEach(box => {
                    const item = document.createElement('div');
                    item.className = 'box-list-item-code ' + (box.type === 'exterior' ? 'exposed' : 'blind');
                    item.innerText = box.boxCode;
                    item.title = `Coord: ${box.id} (${box.type === 'exterior' ? 'Expuesta' : 'Ciega'})`;
                    gridDiv.appendChild(item);
                });

                groupDiv.appendChild(headerDiv);
                groupDiv.appendChild(gridDiv);
                listContainer.appendChild(groupDiv);
            });
        }

        // Enable or disable approval button based on selection
        const btnApprove = document.getElementById('btn-approve-plist');
        if (btnApprove) {
            btnApprove.disabled = selectedFolios.length === 0;
        }

        if (!isInitial) {
            this.state.soundManager.playBeep();
            this.logConsole(`[INSPECTOR] Muestra modificada manualmente. Folios seleccionados: ${selectedFolios.join(', ')}`);
        }
    }

    recepcionarPalletFisico() {
        const input = document.getElementById('input-recepcion-pallet');
        const folio = input.value.trim();
        if (!folio) {
            alert("Ingrese o pistolee el folio del pallet.");
            return;
        }
        input.value = '';
        input.focus();

        if (!this.state.activePackingList) {
            alert("Debe cargar una solicitud en el Paso 1 primero.");
            return;
        }

        const pallet = this.state.activePackingList.palletsList.find(p => p.folio === folio);
        if (!pallet) {
            this.state.soundManager.playBuzzer();
            alert(`🚨 ERROR DE ESCANEO\n\nEl folio ${folio} no pertenece a esta Solicitud de Inspección SAG.`);
            this.logConsole(`[ERROR RECEPCIÓN] Folio ${folio} rechazado. No pertenece a la solicitud.`, 'error');
            return;
        }

        if (this.state.verifiedPallets[folio]) {
            this.logConsole(`[RECEPCIÓN] El folio ${folio} ya fue verificado previamente.`);
            return;
        }

        // Verify physical presence
        this.state.verifiedPallets[folio] = true;
        this.state.soundManager.playBeep();
        this.logConsole(`[RECEPCIÓN] Pallet Folio ${folio} verificado físicamente y presente en andén.`);

        // Update UI badge
        const badge = document.getElementById(`presence-${folio}`);
        if (badge) {
            badge.className = "badge-item-status approved";
            badge.innerHTML = "✔️ Presente";
        }

        // Enable checkbox
        const chk = document.getElementById(`chk-${folio}`);
        if (chk) {
            chk.disabled = false;
            if (chk.dataset.defaultChecked === 'true') {
                chk.checked = true;
            }
        }

        // Update the sample list
        this.updateSelectedPalletsMuestra();
    }

    recepcionarTodosLosPalletsFisicos() {
        if (!this.state.activePackingList) return;

        this.state.soundManager.playBeep();
        this.logConsole(`[RECEPCIÓN] Iniciando verificación masiva de todo el lote...`);

        this.state.activePackingList.palletsList.forEach(p => {
            this.state.verifiedPallets[p.folio] = true;
            
            // Update UI badge
            const badge = document.getElementById(`presence-${p.folio}`);
            if (badge) {
                badge.className = "badge-item-status approved";
                badge.innerHTML = "✔️ Presente";
            }

            // Enable checkbox
            const chk = document.getElementById(`chk-${p.folio}`);
            if (chk) {
                chk.disabled = false;
                if (chk.dataset.defaultChecked === 'true') {
                    chk.checked = true;
                }
            }
        });

        this.logConsole(`[RECEPCIÓN] Todos los ${this.state.activePackingList.pallets} pallets verificados físicamente como PRESENTES.`);
        this.updateSelectedPalletsMuestra();
    }

    approvePackingList() {
        if (!this.state.activePackingList) return;

        // Retrieve manually selected sample folios from checkboxes
        const checkboxes = document.querySelectorAll('.sample-pallet-chk');
        const selectedFolios = [];
        checkboxes.forEach(chk => {
            if (chk.checked) {
                selectedFolios.push(chk.dataset.folio);
            }
        });

        if (selectedFolios.length === 0) {
            alert("Por favor, seleccione al menos 1 pallet para la muestra de inspección.");
            return;
        }

        this.state.packingListApproved = true;
        
        this.state.sapPalletSample = [...selectedFolios];
        this.state.palletStates = {};
        this.state.sapPalletSample.forEach(f => {
            this.state.palletStates[f] = 'pending';
        });
        this.state.completedPalletInspections = {};

        // Update header metadata
        document.getElementById('header-plist').innerText = this.state.activePackingList.lote;
        const statusBadge = document.getElementById('header-status');
        statusBadge.classList.remove('locked');
        statusBadge.classList.add('active-run');
        statusBadge.innerText = "SAG AUTORIZADO";

        this.state.soundManager.playBeep();
        this.logConsole(`[CONTRAPARTE SAG] Lote ${this.state.activePackingList.lote} APROBADO Y HABILITADO.`);

        // Render Step 2 SAP requested folios list
        this.renderSapRequestedPalletsList();

        // Unlock next step
        document.getElementById('lock-step-2').innerText = '🔓';
        
        // Auto-navigate to step 2
        this.setStep(2);
    }

    renderSapRequestedPalletsList() {
        const list = document.getElementById('sap-requested-folios-list');
        if (!list) return;

        list.innerHTML = '';
        this.state.sapPalletSample.forEach(f => {
            const state = this.state.palletStates[f];
            
            let badgeClass = 'pending';
            let badgeText = 'Pendiente';
            if (state === 'active') { badgeClass = 'pending'; badgeText = 'En Proceso'; }
            if (state === 'completed') { badgeClass = 'approved'; badgeText = 'Inspeccionado'; }

            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.padding = '8px 12px';
            li.style.background = 'var(--color-bg-card-hover)';
            li.style.border = '1px solid var(--color-border)';
            li.style.borderRadius = '4px';
            li.style.marginTop = '4px';

            li.innerHTML = `
                <span class="font-mono text-bold" style="letter-spacing:1px;">Folio: ${f}</span>
                <span class="badge-item-status ${badgeClass}">${badgeText}</span>
            `;
            list.appendChild(li);
        });

        // Populate dynamic test hints based on what the inspector actually selected
        const hintsList = document.getElementById('step2-dynamic-hints');
        if (hintsList) {
            hintsList.innerHTML = '';
            
            this.state.sapPalletSample.forEach(f => {
                const li = document.createElement('li');
                li.style.display = 'flex';
                li.style.alignItems = 'center';
                li.style.gap = '8px';
                
                const isCompleted = this.state.palletStates[f] === 'completed';
                const styleClass = isCompleted ? 'style="opacity: 0.5;"' : '';
                
                li.innerHTML = `
                    <span ${styleClass}>Pallet Folio:</span>
                    <code onclick="app.setDemoFolio('${f}')" class="font-mono text-bold" style="cursor:pointer; color:var(--color-primary); background:var(--color-bg-card); padding:2px 6px; border:1px solid var(--color-border); border-radius:4px;">${f}</code>
                    ${isCompleted ? '<span class="text-green" style="font-size:0.85rem;">✔️ Listo</span>' : '<span class="text-warning" style="font-size:0.85rem;">⌛ Pendiente</span>'}
                `;
                hintsList.appendChild(li);
            });

            // Always add a helper for wrong scan testing
            const liWrong = document.createElement('li');
            liWrong.style.marginTop = '8px';
            liWrong.style.borderTop = '1px dashed var(--color-border)';
            liWrong.style.paddingTop = '8px';
            liWrong.innerHTML = `
                <span>Folio No Muestra (Error):</span>
                <code onclick="app.setDemoFolio('9999999999')" class="font-mono text-bold" style="cursor:pointer; color:var(--color-danger); background:var(--color-bg-card); padding:2px 6px; border:1px solid var(--color-border); border-radius:4px;">9999999999</code>
            `;
            hintsList.appendChild(liWrong);
        }
    }

    // STEP 2 LOGIC: TARJADOR
    setDemoFolio(val) {
        document.getElementById('input-barcode').value = val;
        this.state.soundManager.playBeep();
    }

    scanFolio() {
        const inputVal = document.getElementById('input-barcode').value.trim();

        if (inputVal.length !== 10 || isNaN(inputVal)) {
            this.state.soundManager.playBuzzer();
            this.logConsole(`[ERROR SCAN] El folio debe tener exactamente 10 dígitos numéricos.`, 'error');
            alert("Error: El Folio debe constar de 10 dígitos numéricos.");
            return;
        }

        // Verify that this folio was requested by SAP
        if (!this.state.sapPalletSample.includes(inputVal)) {
            this.state.soundManager.playBuzzer();
            this.logConsole(`[ERROR CRUCE] Folio ${inputVal} NO solicitado por SAP para inspección del lote.`, 'error');
            
            const couplingCard = document.getElementById('coupling-card');
            const couplingPulse = document.getElementById('coupling-pulse');
            const couplingText = document.getElementById('coupling-text');

            couplingCard.style.borderColor = 'var(--color-danger)';
            couplingPulse.className = 'circle-pulse red';
            couplingText.innerText = "Error: Folio no solicitado por SAP";
            
            alert("Error de Acoplamiento: SAP no ha solicitado inspeccionar el folio " + inputVal + ".");
            return;
        }

        // Verify it is not already completed
        if (this.state.palletStates[inputVal] === 'completed') {
            this.state.soundManager.playBuzzer();
            alert("El folio " + inputVal + " ya fue inspeccionado completamente.");
            return;
        }

        // Successfully coupled!
        this.state.activeFolio = inputVal;
        this.state.palletStates[inputVal] = 'active';
        document.getElementById('header-folio').innerText = inputVal;
        
        // Generate boxes database
        this.state.boxes = generatePalletBoxes(inputVal, this.state.activePackingList.name);

        const couplingCard = document.getElementById('coupling-card');
        const couplingPulse = document.getElementById('coupling-pulse');
        const couplingText = document.getElementById('coupling-text');

        couplingCard.style.borderColor = 'var(--color-primary)';
        couplingPulse.className = 'circle-pulse green';
        couplingText.innerHTML = `Pallet Vinculado Exitosamente<br><small class="text-accent font-mono">Folio: ${inputVal}</small>`;

        this.state.soundManager.playBeep();
        this.logConsole(`[TARJADOR] Folio ${inputVal} vinculado contra muestra de SAP.`);
        
        this.renderSapRequestedPalletsList();

        document.getElementById('lock-step-3').innerText = '🔓';

        // Navigate automatically
        setTimeout(() => {
            this.setStep(3);
        }, 1200);
    }

    // STEP 3 LOGIC: MODULO DE VISION
    simulateCapture(face) {
        if (this.state.capturedFaces[face]) return;

        this.state.capturedFaces[face] = true;
        
        // Update label to show folio association
        const label = document.getElementById(`cap-label-${face}`);
        if (label) {
            label.innerText = `CARA ${face} - Folio: ${this.state.activeFolio}`;
        }

        // Update thumbnail state
        const item = document.getElementById(`cap-face-${face}`);
        if (item) {
            item.classList.add('done');
        }
        
        const status = document.getElementById(`cap-status-${face}`);
        if (status) {
            status.innerText = "Capturado HD";
        }

        // Inject associated photo mockup with watermark
        const thumb = document.getElementById(`thumb-${face}`);
        if (thumb) {
            const time = new Date().toLocaleTimeString('es-CL');
            thumb.innerHTML = `
                <div class="photo-watermark-overlay" style="width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; background:#e0f2fe; border: 1.5px dashed #3a7ca5; border-radius: var(--radius-sm); padding: 15px; text-align:center; box-sizing:border-box;">
                    <span style="font-size:0.6rem; font-weight:800; color:#1e4e70; letter-spacing:1.5px; text-transform:uppercase;">📷 CÁMARA HD VINCULADA</span>
                    <span style="font-size:0.9rem; font-weight:800; color:#276330; margin-top:5px; font-family:var(--font-mono); letter-spacing:0.5px;">${this.state.activeFolio}</span>
                    <span style="font-size:0.7rem; color:#475569; margin-top:2px; font-weight:600;">Cara ${face} (Costado)</span>
                    <span style="font-size:0.55rem; color:#64748b; margin-top:6px; font-family:var(--font-mono);">Timestamp: ${time}</span>
                    <span style="font-size:0.55rem; color:#22c55e; font-weight:800; margin-top:4px; letter-spacing:0.5px;">✔ REGISTRO ASOCIADO SAG</span>
                </div>
            `;
        }
        
        this.state.soundManager.playBeep();
        this.logConsole(`[VISIÓN] Foto HD capturada y vinculada para Folio ${this.state.activeFolio} (Cara ${face}).`);

        // Check if all faces are captured
        if (Object.values(this.state.capturedFaces).every(v => v === true)) {
            this.evaluateCuadratura();
        }
    }

    simulateAllCaptures() {
        this.simulateCapture('A');
        setTimeout(() => this.simulateCapture('B'), 250);
        setTimeout(() => this.simulateCapture('C'), 500);
        setTimeout(() => this.simulateCapture('D'), 750);
    }

    evaluateCuadratura() {
        const expected = this.state.boxes.length;
        
        // Define physical counted boxes
        let physical = expected;
        if (this.state.activePackingList.name === 'solicitud_5345_error' && this.state.activeFolio === '1020006903' && !this.state.cuadraturaAdjusted) {
            physical = 180; // Cause physical discrepancy
        }

        this.state.physicalBoxCount = physical;

        document.getElementById('vision-cnt-theoretical').innerText = expected;
        document.getElementById('vision-cnt-physical').innerText = physical;

        const alertBox = document.getElementById('cuadratura-alert-box');
        const alertTitle = document.getElementById('cuadratura-alert-title');
        const alertDesc = document.getElementById('cuadratura-alert-desc');
        const errorPane = document.getElementById('pane-error-cuadratura');
        const btnNext = document.getElementById('btn-goto-step4');

        if (physical === expected) {
            this.state.cuadraturaCompleted = true;
            
            // Calculate breakdown
            const total = this.state.boxes.length;
            const exteriorCount = this.state.boxes.filter(b => b.type === 'exterior').length;
            const interiorCount = this.state.boxes.filter(b => b.type === 'interior').length;

            alertBox.className = "alert-box-success";
            alertTitle.innerText = "Cuadratura Exitosa (100%)";
            alertDesc.innerHTML = `
                El conteo físico de cajas expuestas coincide perfectamente con las cajas teóricas.<br>
                • <strong>Capturadas en Fotos (4 Caras):</strong> ${exteriorCount} cajas visibles con códigos de 10 números.<br>
                • <strong>Determinadas Automáticamente como Ciegas:</strong> ${interiorCount} cajas en el interior de la estiba.
            `;
            errorPane.style.display = 'none';
            btnNext.disabled = false;
            
            this.state.soundManager.playBeep();
            this.logConsole(`[VISIÓN] Cuadratura exitosa. Mapeo: ${exteriorCount} expuestas detectadas, ${interiorCount} ciegas determinadas.`);
            document.getElementById('lock-step-4').innerText = '🔓';
        } else {
            this.state.cuadraturaCompleted = false;
            
            alertBox.className = "alert-box-danger";
            alertTitle.innerText = "Alerta: Descuadre de Lote";
            alertDesc.innerText = `Discrepancia detectada. Conteo físico de IA es de ${physical} cajas, pero la Contraparte SAG declaró ${expected} cajas.`;
            errorPane.style.display = 'block';
            btnNext.disabled = true;

            this.state.soundManager.playBuzzer();
            this.logConsole(`[ALERTA DESCUADRE] Discrepancia: Físico ${physical} vs Teórico ${expected}. Proceso bloqueado.`, 'error');
        }
    }

    // Corrective Actions for Cuadratura discrepancy
    reemitirERP() {
        // Adjust the ERP declarations to the physical count
        this.state.activePackingList.cajas = this.state.physicalBoxCount;
        this.state.cuadraturaAdjusted = true;
        this.logConsole(`[CONTRAPARTE SAG] Planilla ajustada en ERP a ${this.state.physicalBoxCount} cajas para cuadrar lote.`);
        
        // Re-generate boxes to match new count of 180 boxes
        // Let's remove 4 boxes from level 12 (telescopic top layer) to get exactly 180 boxes
        this.state.boxes = this.state.boxes.filter(b => b.id !== 'N12-A-C1' && b.id !== 'N12-A-C2' && b.id !== 'N12-B-C1' && b.id !== 'N12-B-C2');
        
        // Refresh step 1 accordion view
        const listContainer = document.getElementById('plist-boxes-list');
        listContainer.innerHTML = '';
        this.state.boxes.forEach(box => {
            const item = document.createElement('div');
            item.className = 'box-list-item-code ' + (box.type === 'exterior' ? 'exposed' : 'blind');
            item.innerText = box.boxCode;
            item.title = `Coord: ${box.id} (${box.type === 'exterior' ? 'Expuesta' : 'Ciega'})`;
            listContainer.appendChild(item);
        });

        this.evaluateCuadratura();
    }

    reacomodarFisico() {
        // Operator re-arranges the pallet to add missing 4 boxes
        this.state.physicalBoxCount = this.state.boxes.length;
        this.state.cuadraturaAdjusted = true;
        this.logConsole(`[OPERADOR] Cajas reacomodadas en pallet físico. Conteo re-evaluado a ${this.state.boxes.length} cajas.`);
        this.evaluateCuadratura();
    }

    goToStep4() {
        this.setStep(4);
    }

    goToTablet() {
        this.setStep(5);
    }

    // STEP 4 LOGIC: MOTOR IA & OVERLAY
    simulateNeuralProcess() {
        const loader = document.getElementById('overlay-loader');
        const stats = document.getElementById('overlay-stats');
        const alertRes = document.getElementById('vision-resolution-alert');
        const btnNext = document.getElementById('btn-goto-tablet');

        loader.style.display = 'flex';
        stats.style.display = 'none';
        alertRes.style.display = 'none';
        btnNext.disabled = true;

        setTimeout(() => {
            loader.style.display = 'none';
            stats.style.display = 'grid';
            alertRes.style.display = 'block';
            btnNext.disabled = false;

            const total = this.state.boxes.length;
            const obstructed = this.state.boxes.filter(b => b.obstructedByZuncho).length;
            const read = total - obstructed;

            document.getElementById('stats-detected').innerText = total;
            document.getElementById('stats-read').innerText = read;
            document.getElementById('stats-obstructed').innerText = obstructed;

            this.state.overlayDetectionsGenerated = true;
            document.getElementById('lock-step-5').innerText = '🔓';

            // Draw wireframe representation on step 4 right panel
            this.drawPalletWireframe();
            
            this.state.soundManager.playBeep();
            this.logConsole(`[MOTOR IA] Mapeo espacial completo. ${total} cajas localizadas. ${read} Data Matrix leídos. ${obstructed} obstruidos por zuncho verde.`);
        }, 1200);
    }

    drawPalletWireframe() {
        const container = document.getElementById('wireframe-viz');
        container.innerHTML = '';

        // Draw 12 rows, each row showing Face A Col 1, Col 2 (just for simple visual)
        for (let lvl = 12; lvl >= 1; lvl--) {
            const row = document.createElement('div');
            row.className = 'wireframe-level-row';

            const levelStr = String(lvl).padStart(2, '0');
            
            // Col 1
            const box1Id = `N${levelStr}-A-C1`;
            const box1 = this.state.boxes.find(b => b.id === box1Id);
            const box1Div = document.createElement('div');
            box1Div.className = `wireframe-box ${box1 ? 'detected' : ''}`;
            if (box1) {
                if (box1.obstructedByZuncho) box1Div.classList.add('obstructed');
                else box1Div.classList.add('decoded');
                box1Div.innerText = `N${levelStr}-C1`;
            }
            row.appendChild(box1Div);

            // Col 2
            const box2Id = `N${levelStr}-A-C2`;
            const box2 = this.state.boxes.find(b => b.id === box2Id);
            const box2Div = document.createElement('div');
            box2Div.className = `wireframe-box ${box2 ? 'detected' : ''}`;
            if (box2) {
                if (box2.obstructedByZuncho) box2Div.classList.add('obstructed');
                else box2Div.classList.add('decoded');
                box2Div.innerText = `N${levelStr}-C2`;
            }
            row.appendChild(box2Div);

            container.appendChild(row);
        }
    }

    goToTablet() {
        this.setStep(5);
    }

    // STEP 5 LOGIC: TABLET INSPECTOR (OVERLAY & DIRECT SELECTION)
    changeInspectorFace(face) {
        this.state.inspectorActiveFace = face;
        
        // Update tabs
        document.querySelectorAll('.face-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(`tab-face-${face}`).classList.add('active');
        document.getElementById('active-inspector-face-lbl').innerText = `CARA ${face} (${face === 'A' ? 'Frontal' : face === 'B' ? 'Lateral D' : face === 'C' ? 'Posterior' : 'Lateral I'})`;

        this.loadInspectorPalletView();
        this.state.soundManager.playBeep();
    }

    loadInspectorPalletView() {
        const container = document.getElementById('bounding-boxes-container');
        container.innerHTML = '';

        const face = this.state.inspectorActiveFace;

        // Render 12 levels for current face
        // Level 12 down to 1
        for (let lvl = 12; lvl >= 1; lvl--) {
            const levelStr = String(lvl).padStart(2, '0');
            const rowDiv = document.createElement('div');
            rowDiv.className = 'bounding-box-row';

            for (let col = 1; col <= 2; col++) {
                const boxId = `N${levelStr}-${face}-C${col}`;
                const box = this.state.boxes.find(b => b.id === boxId);

                if (box) {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'bounding-box-item';
                    itemDiv.id = `box-item-${boxId}`;
                    
                    // Apply current statuses classes
                    if (box.status === 'suggested') itemDiv.classList.add('suggested');
                    if (box.status === 'selected') itemDiv.classList.add('selected');
                    if (box.status === 'approved') itemDiv.classList.add('selected'); // Keep selected visual
                    if (box.status === 'rejected') itemDiv.classList.add('rejected');
                    if (box.obstructedByZuncho && !box.manualReadConfirmed) {
                        itemDiv.classList.add('obstructed-overlay');
                    }

                    itemDiv.innerHTML = `
                        <span class="box-coordinate-lbl">${box.id}</span>
                        <span class="box-code-lbl" style="font-size: 0.55rem; font-family: var(--font-mono); font-weight: 700; color: rgba(255,255,255,0.7); margin-top:2px;">${box.boxCode}</span>
                    `;

                    itemDiv.onclick = () => this.handleBoxClick(box.id);
                    rowDiv.appendChild(itemDiv);
                } else {
                    // Empty placeholder if box removed during ERP adjustments
                    const emptyDiv = document.createElement('div');
                    rowDiv.appendChild(emptyDiv);
                }
            }
            container.appendChild(rowDiv);
        }

        this.updateMuestraOverviewPanel();
    }

    handleBoxClick(boxId) {
        const box = this.state.boxes.find(b => b.id === boxId);
        if (!box) return;

        // 1. Check if obstructed by zuncho
        if (box.obstructedByZuncho && !box.manualReadConfirmed) {
            this.openManualScanModal(boxId);
            return;
        }

        // 2. Standard Click (Toggle Selection)
        if (box.status === 'unselected' || box.status === 'suggested') {
            box.status = 'selected';
            this.state.soundManager.playBeep();
            this.logConsole(`[INSPECTOR] Caja ${boxId} seleccionada táctil para muestra.`);
        } else if (box.status === 'selected') {
            // Revert back
            // Check if it was originally suggested
            const origSuggested = boxId.includes('N04-A-C1') || boxId.includes('N07-B-C2') || boxId.includes('N11-C-C1') || boxId.includes('N02-D-C2');
            box.status = origSuggested ? 'suggested' : 'unselected';
            this.state.soundManager.playBeep();
            this.logConsole(`[INSPECTOR] Caja ${boxId} deseleccionada.`);
        }

        this.state.selectedBoxId = box.status === 'selected' ? boxId : null;
        
        this.loadInspectorPalletView();
        this.updateSelectionDetails(boxId);
    }

    updateSelectionDetails(boxId) {
        const container = document.getElementById('selection-details-data');
        if (!boxId) {
            container.innerHTML = `
                <div class="empty-selection-msg">
                    <span>Toque una caja en el pallet de la izquierda para ver su trazabilidad o programar muestra.</span>
                </div>
            `;
            return;
        }

        const box = this.state.boxes.find(b => b.id === boxId);
        if (!box) return;

        let statusText = "No Seleccionada";
        let statusClass = "text-muted";
        if (box.status === 'suggested') { statusText = "Sugerida Algoritmo (Aleatoria)"; statusClass = "text-green"; }
        if (box.status === 'selected') { statusText = "Seleccionada Inspector"; statusClass = "text-accent"; }
        if (box.status === 'rejected') { statusText = "Rechazada (Hallazgo)"; statusClass = "text-red"; }

        container.innerHTML = `
            <div class="selection-details-panel">
                <div class="detail-row">
                    <span>Coordenada SAG:</span>
                    <span class="text-accent font-mono">${box.id}</span>
                </div>
                <div class="detail-row">
                    <span>Número de Caja (10D):</span>
                    <span class="font-mono text-bold text-accent">${box.boxCode}</span>
                </div>
                <div class="detail-row">
                    <span>Código Data Matrix:</span>
                    <span class="font-mono text-bold">${box.obstructedByZuncho && !box.manualReadConfirmed ? 'OBSTRUIDO POR ZUNCHO' : box.dataMatrix}</span>
                </div>
                <div class="detail-row">
                    <span>Nivel Físico:</span>
                    <span>${box.level} (de 12)</span>
                </div>
                <div class="detail-row">
                    <span>Cara / Columna:</span>
                    <span>Cara ${box.face} - Columna ${box.column}</span>
                </div>
                <div class="detail-row">
                    <span>Estado Muestra:</span>
                    <span class="${statusClass}">${statusText}</span>
                </div>
                ${box.obstructedByZuncho ? `
                <div class="detail-row mt-xs">
                    <span class="text-warning text-bold">Etiqueta Zunchada:</span>
                    <span class="text-warning">Lectura Manual Confirmada</span>
                </div>` : ''}
            </div>
        `;
    }

    // Modal Manual Reading Assist
    openManualScanModal(boxId) {
        this.state.soundManager.playBuzzer(); // Sound warning
        
        const box = this.state.boxes.find(b => b.id === boxId);
        document.getElementById('modal-box-coord').value = boxId;
        document.getElementById('modal-box-dm-expected').value = box.dataMatrix;
        document.getElementById('modal-input-dm-read').value = '';
        
        document.getElementById('modal-manual-scan').style.display = 'flex';
        document.getElementById('modal-input-dm-read').focus();
    }

    confirmManualScan() {
        const inputVal = document.getElementById('modal-input-dm-read').value.trim();
        const coord = document.getElementById('modal-box-coord').value;
        const expected = document.getElementById('modal-box-dm-expected').value;

        if (inputVal === '') {
            alert("Debe ingresar el código Data Matrix de la etiqueta física.");
            return;
        }

        const box = this.state.boxes.find(b => b.id === coord);
        
        // Manual validation assist
        if (inputVal.toUpperCase() !== expected.toUpperCase()) {
            this.state.soundManager.playBuzzer();
            alert("Error: El código Data Matrix ingresado no concuerda con la base de datos de trazabilidad del lote.");
            return;
        }

        // Correct code manual confirmation!
        box.manualReadConfirmed = true;
        box.status = 'selected';
        
        this.state.soundManager.playBeep();
        this.logConsole(`[MANUAL READ] Lectura asistida confirmada para ${coord}. Código: ${expected}.`);
        
        this.closeModal('modal-manual-scan');
        this.loadInspectorPalletView();
        this.updateSelectionDetails(coord);
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    // Blind Boxes Logic
    loadBlindBoxesForLevel(lvlVal) {
        const buttonsContainer = document.getElementById('blind-boxes-buttons-container');
        const grid = document.getElementById('blind-buttons-grid');
        const helper = document.getElementById('blind-helper-directions');

        if (!lvlVal) {
            buttonsContainer.style.display = 'none';
            helper.style.display = 'none';
            return;
        }

        this.state.blindLevelSelected = parseInt(lvlVal);
        const levelStr = String(lvlVal).padStart(2, '0');

        grid.innerHTML = '';
        
        // We have 8 blind core boxes per level
        for (let i = 1; i <= 8; i++) {
            const blindId = `N${levelStr}-INT${i}`;
            const box = this.state.boxes.find(b => b.id === blindId);
            
            const btn = document.createElement('button');
            btn.className = 'btn-blind-box';
            if (box && (box.status === 'selected' || box.status === 'approved' || box.status === 'rejected')) {
                btn.classList.add('selected');
            }
            btn.innerText = `INT ${i}`;
            btn.onclick = () => this.selectBlindBox(blindId);
            grid.appendChild(btn);
        }

        buttonsContainer.style.display = 'block';
        helper.style.display = 'none';
        this.state.soundManager.playBeep();
    }

    selectBlindBox(blindId) {
        this.state.blindBoxSelectedId = blindId;
        
        // Highlight active button
        document.querySelectorAll('.btn-blind-box').forEach(btn => {
            if (btn.innerText === `INT ${blindId.split('INT')[1]}`) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });

        // Compute blocked boxes
        const level = this.state.blindLevelSelected;
        const levelStr = String(level).padStart(2, '0');
        const coreIdx = parseInt(blindId.split('INT')[1]);
        const blockingConfig = InteriorBlockingMatrix[coreIdx];
        
        const blockA = `N${levelStr}-${blockingConfig.face}-C${blockingConfig.cols[0]}`;
        // Calculate a side-room box: next column or adjacent face
        const nextCol = blockingConfig.cols[0] === 1 ? 2 : 1;
        const blockB = `N${levelStr}-${blockingConfig.face}-C${nextCol}`;

        const box = this.state.boxes.find(b => b.id === blindId);
        document.getElementById('blind-box-id-lbl').innerText = `${blindId} (Cod: ${box ? box.boxCode : ''})`;
        const blockingList = document.getElementById('blocking-cajas-list');
        blockingList.innerHTML = `
            <li>Caja Directa Bloqueante: <span class="text-accent">${blockA}</span> (${blockingConfig.description})</li>
            <li>Caja Auxiliar Holgura: <span class="text-warning">${blockB}</span></li>
        `;

        document.getElementById('blind-helper-directions').style.display = 'block';
        this.state.soundManager.playBeep();
        this.logConsole(`[CIEGA HELPER] Plan de desmontaje generado para ${blindId}. Bloqueantes: ${blockA}, ${blockB}.`);
    }

    addBlindBoxToMuestra() {
        const blindId = this.state.blindBoxSelectedId;
        if (!blindId) return;

        const box = this.state.boxes.find(b => b.id === blindId);
        if (box) {
            box.status = 'selected';
            this.state.soundManager.playBeep();
            this.logConsole(`[INSPECTOR] Caja Ciega ${blindId} agregada a la muestra fitosanitaria.`);
            
            // Highlight exterior blocking boxes in the visual overlay to guide the operator!
            const level = box.level;
            const levelStr = String(level).padStart(2, '0');
            const coreIdx = parseInt(blindId.split('INT')[1]);
            const blockingConfig = InteriorBlockingMatrix[coreIdx];
            
            const outerBlockingId = `N${levelStr}-${blockingConfig.face}-C${blockingConfig.cols[0]}`;
            const outerBox = this.state.boxes.find(b => b.id === outerBlockingId);
            
            // Visual alert warning on tablet face
            if (outerBox && outerBox.status === 'unselected') {
                outerBox.status = 'suggested'; // Turn green to suggest removal
            }

            // Reload UI
            this.loadInspectorPalletView();
            this.loadBlindBoxesForLevel(box.level);
        }
    }

    updateMuestraOverviewPanel() {
        const list = document.getElementById('muestra-items-list');
        list.innerHTML = '';

        const selectedBoxes = this.state.boxes.filter(b => b.status === 'selected' || b.status === 'approved' || b.status === 'rejected');
        
        document.getElementById('muestra-cnt-selected').innerText = selectedBoxes.length;
        
        const rejected = selectedBoxes.filter(b => b.status === 'rejected').length;
        document.getElementById('muestra-cnt-rejected').innerText = rejected;

        // Check algorithmic suggestions covered
        const suggestedIDs = ['N04-A-C1', 'N07-B-C2', 'N11-C-C1', 'N02-D-C2'];
        const coveredSuggested = selectedBoxes.filter(b => suggestedIDs.includes(b.id)).length;
        document.getElementById('muestra-cnt-sug').innerText = `${coveredSuggested}/4`;

        selectedBoxes.forEach(box => {
            let statusText = "Pendiente";
            let statusClass = "pending";

            if (box.status === 'approved') { statusText = "Aprobado"; statusClass = "approved"; }
            if (box.status === 'rejected') { statusText = "Rechazado"; statusClass = "rejected"; }

            const li = document.createElement('li');
            li.className = 'muestra-list-item';
            li.innerHTML = `
                <span>${box.id}</span>
                <span class="badge-item-status ${statusClass}">${statusText}</span>
            `;
            list.appendChild(li);
        });

        // Enable validation button only if sample size is >= 4 (SAG minimum)
        const btnNext = document.getElementById('btn-goto-step6');
        btnNext.disabled = selectedBoxes.length < 4;
    }

    goToStep6() {
        this.setStep(6);
    }

    // STEP 6 LOGIC: PHYSICAL VERIFICATION SCANNING & REPORT Dictamen
    loadPhysicalVerificationView() {
        const instPane = document.getElementById('extraction-instructions-pane');
        const suggestPane = document.getElementById('scan-suggested-hints');
        
        // Find selected boxes
        const selected = this.state.boxes.filter(b => b.status === 'selected' || b.status === 'approved' || b.status === 'rejected');
        const pending = selected.filter(b => b.status === 'selected');

        if (pending.length === 0) {
            // Save current pallet to completed inspections
            this.state.completedPalletInspections[this.state.activeFolio] = {
                boxes: [...this.state.boxes],
                dictamen: selected.filter(b => b.status === 'rejected').length > 0 ? 'RECHAZADO' : 'APROBADO'
            };
            this.state.palletStates[this.state.activeFolio] = 'completed';
            this.renderSapRequestedPalletsList();

            // Check if there are other pending pallets in SAP sample
            const pendingPallets = this.state.sapPalletSample.filter(f => this.state.palletStates[f] === 'pending');

            if (pendingPallets.length > 0) {
                const nextF = pendingPallets[0];
                instPane.innerHTML = `
                    <div class="alert-box-success text-center">
                        <h4>✔ Muestreo de Pallet ${this.state.activeFolio} Completado</h4>
                        <p class="mt-xs">Falta inspeccionar el siguiente pallet de la muestra SAP: <strong class="text-accent font-mono" style="font-size:1.1rem;">${nextF}</strong></p>
                        <p class="small text-muted mt-xs">Haga clic abajo para iniciar la verificación del siguiente pallet físico en el andén.</p>
                    </div>
                    <button class="btn btn-accent btn-full mt-lg" onclick="app.prepareNextPallet('${nextF}')">
                        Iniciar Inspección Siguiente Pallet (Folio: ${nextF})
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="ml-sm">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </button>
                `;
                document.getElementById('box-evaluation-pane').style.display = 'none';
                suggestPane.innerHTML = '';
                document.getElementById('input-dm-verify').disabled = true;
                
                document.getElementById('signature-area').style.display = 'none';
                document.getElementById('btn-finalize-inspection').disabled = true;
                this.updateActaForm();
                return;
            }

            // All pallets in SAP sample are completed!
            instPane.innerHTML = `
                <div class="alert-box-success text-center">
                    <h4>✔ Todos los Pallets de la Muestra SAP Completados</h4>
                    <p class="mt-xs">Se han inspeccionado las cajas de todos los folios requeridos por el sistema. Proceda a firmar el acta del lote fitosanitario.</p>
                </div>
            `;
            document.getElementById('box-evaluation-pane').style.display = 'none';
            suggestPane.innerHTML = '';
            document.getElementById('input-dm-verify').disabled = true;
            
            // Enable signature area and finalization
            document.getElementById('signature-area').style.display = 'block';
            document.getElementById('btn-finalize-inspection').disabled = false;
            
            this.updateActaForm();
            return;
        }

        // Disable finalize button until all done
        document.getElementById('btn-finalize-inspection').disabled = true;
        document.getElementById('signature-area').style.display = 'none';
        document.getElementById('input-dm-verify').disabled = false;

        const currentBox = pending[0];
        
        // Update instruction
        instPane.innerHTML = `
            <div class="extraction-card">
                <span class="badge badge-primary">EXTRACCIÓN EN CURSO</span>
                <h4 class="mt-xs">Coordenada a extraer: <strong class="text-accent font-mono" style="font-size:1.4rem;">${currentBox.id}</strong></h4>
                <div class="detail-row mt-sm">
                    <span>Ubicación:</span>
                    <span>Nivel ${currentBox.level} - Cara ${currentBox.face} - Columna ${currentBox.column}</span>
                </div>
                <div class="detail-row">
                    <span>Código de Caja (10D):</span>
                    <span class="font-mono text-bold text-accent">${currentBox.boxCode}</span>
                </div>
                ${currentBox.type === 'interior' ? `
                <div class="warning-alert-orange mt-xs" style="padding:8px 12px; font-size:0.75rem;">
                    <strong>Atención Movilizador:</strong> Recuerde desmontar las cajas exteriores bloqueantes de ese nivel antes de retirar la caja ciega.
                </div>` : ''}
            </div>
        `;

        // Render fast simulation scan buttons
        suggestPane.innerHTML = `
            <button class="btn-suggested-scan" onclick="app.simulateVerificationScan('${currentBox.boxCode}')">Pistolear Correcto (${currentBox.boxCode})</button>
            <button class="btn-suggested-scan" onclick="app.simulateVerificationScan('8000000000')">Pistolear Código Incorrecto (Simular Error)</button>
        `;

        document.getElementById('input-dm-verify').value = '';
        document.getElementById('input-dm-verify').focus();
        document.getElementById('box-evaluation-pane').style.display = 'none';
        
        this.updateActaForm();
    }

    prepareNextPallet(nextFolio) {
        // Reset states for the new pallet
        this.state.activeFolio = null;
        this.state.capturedFaces = { A: false, B: false, C: false, D: false };
        this.state.physicalBoxCount = 0;
        this.state.cuadraturaCompleted = false;
        this.state.cuadraturaAdjusted = false;
        this.state.overlayDetectionsGenerated = false;
        this.state.boxes = [];
        this.state.selectedBoxId = null;
        this.state.blindLevelSelected = null;
        this.state.blindBoxSelectedId = null;
        this.state.currentExtractionIndex = 0;
        this.state.scannedVerificationError = false;

        // Reset step lock representations
        document.getElementById('lock-step-3').innerText = '🔒';
        document.getElementById('lock-step-4').innerText = '🔒';
        document.getElementById('lock-step-5').innerText = '🔒';
        document.getElementById('lock-step-6').innerText = '🔒';

        // Load next Folio into input field
        document.getElementById('input-barcode').value = nextFolio;
        document.getElementById('header-folio').innerText = "NO ASIGNADO";
        
        // Reset coupling cards
        const couplingCard = document.getElementById('coupling-card');
        const couplingPulse = document.getElementById('coupling-pulse');
        const couplingText = document.getElementById('coupling-text');
        couplingCard.style.borderColor = 'var(--color-border)';
        couplingPulse.className = 'circle-pulse orange';
        couplingText.innerText = "Esperando Lectura de Folio Físico";

        // Reset blind levels select
        document.getElementById('select-blind-level').value = '';

        // Reset Step 3 UI captures
        const faces = ['A', 'B', 'C', 'D'];
        const faceNames = { A: 'Frontal', B: 'Lateral', C: 'Posterior', D: 'Lateral Opuesta' };
        faces.forEach(face => {
            const label = document.getElementById(`cap-label-${face}`);
            if (label) label.innerText = `CARA ${face} (${faceNames[face]})`;
            
            const item = document.getElementById(`cap-face-${face}`);
            if (item) item.classList.remove('done');
            
            const status = document.getElementById(`cap-status-${face}`);
            if (status) status.innerText = "Pendiente";
            
            const thumb = document.getElementById(`thumb-${face}`);
            if (thumb) thumb.innerHTML = '';
        });

        this.setStep(2);
        this.logConsole(`[SISTEMA] Preparando transición para el siguiente pallet SAP: ${nextFolio}.`);
    }

    simulateVerificationScan(code) {
        document.getElementById('input-dm-verify').value = code;
        this.verifyBoxScan();
    }

    verifyBoxScan() {
        const inputVal = document.getElementById('input-dm-verify').value.trim();
        
        // Get current expected box
        const selected = this.state.boxes.filter(b => b.status === 'selected');
        if (selected.length === 0) return;

        const expectedBox = selected[0];

        if (inputVal === '') {
            alert("Ingrese o pistolee el código Data Matrix de la caja extraída.");
            return;
        }

        if (inputVal.toUpperCase() !== expectedBox.boxCode.toUpperCase()) {
            // Scanner Warning Buzzer Sound (Chicharra)
            this.state.soundManager.playBuzzer();
            this.state.scannedVerificationError = true;

            this.logConsole(`[SCAN ERROR] Movilizador pistoleó código incorrecto: ${inputVal}. Se esperaba el código 10D: ${expectedBox.boxCode} en coord ${expectedBox.id}.`, 'error');

            alert(`🚨 ERROR DE EXTRACCIÓN (CHICHARRA)\n\nEl operador extrajo una caja distinta a la coordenada pinchada en la foto.\n\nCódigo Leído: ${inputVal}\nCódigo Requerido (10D): ${expectedBox.boxCode}\nCoordenada Requerida: ${expectedBox.id}\n\nPor favor devuelva la caja errónea y extraiga la correcta.`);
            return;
        }

        // Correct box scan!
        this.state.soundManager.playBeep();
        this.state.scannedVerificationError = false;
        this.logConsole(`[SCAN OK] Pistoleo correcto de caja coordenada ${expectedBox.id}. Código 10D: ${expectedBox.boxCode} verificado.`);

        // Open evaluation window
        document.getElementById('eval-box-id-lbl').innerText = expectedBox.id;
        document.getElementById('box-evaluation-pane').style.display = 'block';
    }

    evaluateBox(result) {
        const selected = this.state.boxes.filter(b => b.status === 'selected');
        if (selected.length === 0) return;

        const currentBox = selected[0];
        
        // Set evaluation state
        currentBox.status = result === 'APPROVED' ? 'approved' : 'rejected';
        currentBox.evalState = result;
        
        this.state.soundManager.playBeep();
        this.logConsole(`[SAG INSPECTOR] Caja ${currentBox.id} evaluada. Dictamen: ${result}.`);

        // Reload verification step layout
        this.loadPhysicalVerificationView();
    }

    updateActaForm() {
        let allSelected = [];
        // Gather from completed pallet inspections
        for (const f in this.state.completedPalletInspections) {
            allSelected.push(...this.state.completedPalletInspections[f].boxes.filter(b => b.status === 'approved' || b.status === 'rejected'));
        }
        // Also add current pallet
        const currentSelected = this.state.boxes.filter(b => b.status === 'selected' || b.status === 'approved' || b.status === 'rejected');
        currentSelected.forEach(box => {
            if (!allSelected.find(b => b.boxCode === box.boxCode)) {
                allSelected.push(box);
            }
        });

        const approved = allSelected.filter(b => b.status === 'approved');
        const rejected = allSelected.filter(b => b.status === 'rejected');

        document.getElementById('acta-folio').innerText = this.state.sapPalletSample.join(', ');
        document.getElementById('acta-plist').innerText = this.state.activePackingList.lote;
        document.getElementById('acta-tot-cajas').innerText = `${this.state.activePackingList.cajas} Cajas (${this.state.activePackingList.pallets} Pallets)`;
        
        const evaluatedCount = approved.length + rejected.length;
        document.getElementById('acta-audited-cnt').innerText = evaluatedCount;
        document.getElementById('acta-rejected-cnt').innerText = rejected.length;

        const dictamenTag = document.getElementById('acta-dictamen');
        
        // Check if there are still pending pallets or pending boxes on the active pallet
        const pendingPallets = this.state.sapPalletSample.filter(f => this.state.palletStates[f] === 'pending');
        const pendingActiveBoxes = this.state.boxes.filter(b => b.status === 'selected');

        if (pendingPallets.length > 0 || pendingActiveBoxes.length > 0) {
            dictamenTag.className = "status-tag locked";
            dictamenTag.innerText = "PENDIENTE MUESTRA";
        } else if (rejected.length > 0) {
            dictamenTag.className = "status-tag locked";
            dictamenTag.innerText = "LOTE RECHAZADO";
        } else {
            dictamenTag.className = "status-tag active-run";
            dictamenTag.innerText = "LOTE APROBADO";
        }
    }

    finalizeInspection() {
        const sigInput = document.getElementById('input-inspector-signature').value.trim();
        if (sigInput === '') {
            this.state.soundManager.playBuzzer();
            alert("Para emitir el certificado oficial del SAG es obligatoria la Firma Digital de Conformidad del inspector.");
            document.getElementById('input-inspector-signature').focus();
            return;
        }

        // Build list of all samples evaluated across all pallets
        let allSelected = [];
        for (const f in this.state.completedPalletInspections) {
            allSelected.push(...this.state.completedPalletInspections[f].boxes.filter(b => b.status === 'approved' || b.status === 'rejected'));
        }
        const currentSelected = this.state.boxes.filter(b => b.status === 'approved' || b.status === 'rejected');
        currentSelected.forEach(box => {
            if (!allSelected.find(b => b.boxCode === box.boxCode)) {
                allSelected.push(box);
            }
        });

        const rejected = allSelected.filter(b => b.status === 'rejected').length;

        document.getElementById('cert-no').innerText = Math.floor(1000 + Math.random() * 9000);
        document.getElementById('cert-date').innerText = new Date().toLocaleDateString('es-CL');
        document.getElementById('cert-folio-id').innerText = this.state.sapPalletSample.join(', ');
        document.getElementById('cert-plist-id').innerText = this.state.activePackingList.lote;
        document.getElementById('cert-variedad').innerText = this.state.activePackingList.variedad;
        document.getElementById('cert-calibre').innerText = this.state.activePackingList.calibre;
        document.getElementById('cert-total-cajas').innerText = `${this.state.activePackingList.cajas} Cajas (${this.state.activePackingList.pallets} Pallets)`;
        document.getElementById('cert-inspector-sig').innerText = sigInput;

        // Build sample table
        const tbody = document.getElementById('cert-muestra-tbody');
        tbody.innerHTML = '';
        allSelected.forEach(box => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="font-mono text-bold">${box.id}</td>
                <td>Nivel ${box.level} - Col ${box.column}</td>
                <td>${box.type === 'interior' ? 'Interior (Ciega)' : 'Exterior'}</td>
                <td class="font-mono">${box.obstructedByZuncho && !box.manualReadConfirmed ? 'Lectura manual (' + box.boxCode + ')' : box.boxCode}</td>
                <td class="text-bold ${box.evalState === 'APPROVED' ? 'text-green' : 'text-red'}">${box.evalState === 'APPROVED' ? 'APROBADO' : 'RECHAZADO FITOSANITARIO'}</td>
            `;
            tbody.appendChild(tr);
        });

        // Dictamen Final Box styling
        const dictBox = document.getElementById('cert-dictamen-pane');
        const dictVal = document.getElementById('cert-dictamen-val');
        
        if (rejected > 0) {
            dictBox.style.borderColor = 'var(--color-danger)';
            dictBox.style.backgroundColor = 'rgba(231, 76, 60, 0.05)';
            dictVal.className = "cert-result text-red text-bold";
            dictVal.innerText = "LOTE RECHAZADO - INGRESO BLOQUEADO";
            dictBox.querySelector('p').innerText = "Se detectó presencia de plaga en las muestras de la estiba. El lote completo debe ser re-stow, re-procesado o fumigado según dictamen SAG.";
        } else {
            dictBox.style.borderColor = '#22c55e';
            dictBox.style.backgroundColor = '#f0fdf4';
            dictVal.className = "cert-result text-green text-bold";
            dictVal.innerText = "APROBADO PARA EXPORTACIÓN SAG";
            dictBox.querySelector('p').innerText = "El lote cumple con las exigencias del mercado de destino y las normativas fitosanitarias vigentes.";
        }

        // Save to History (LocalStorage)
        const dictamenText = rejected > 0 ? 'RECHAZADO' : 'APROBADO';
        const inspectionRecord = {
            id: 'INS-' + Date.now(),
            date: new Date().toLocaleString('es-CL'),
            folio: this.state.sapPalletSample.join(', '),
            lote: this.state.activePackingList.lote,
            variedad: this.state.activePackingList.variedad,
            calibre: this.state.activePackingList.calibre,
            totalCajas: `${this.state.activePackingList.cajas} (${this.state.activePackingList.pallets} Pallets)`,
            inspector: sigInput,
            dictamen: dictamenText,
            samples: allSelected.map(box => ({
                id: box.id,
                type: box.type,
                boxCode: box.boxCode,
                evalState: box.evalState
            }))
        };

        try {
            let history = JSON.parse(localStorage.getItem('prize_sag_inspections')) || [];
            history.unshift(inspectionRecord); // Newest first
            localStorage.setItem('prize_sag_inspections', JSON.stringify(history));
            this.logConsole(`[HISTORIAL] Inspección de lote ${this.state.activePackingList.lote} guardada localmente.`);
        } catch (e) {
            console.error('Error saving history to LocalStorage', e);
        }

        this.state.soundManager.playBeep();
        document.getElementById('modal-acta-sag').style.display = 'flex';
        this.logConsole(`[SISTEMA ACTA] Certificado de Inspección oficial emitido para lote ${this.state.activePackingList.lote}.`);
    }

    // --- Technical Log Console Utility ---
    logConsole(msg, type = 'system') {
        const consoleLogs = document.getElementById('console-logs');
        if (!consoleLogs) return;

        const time = new Date().toLocaleTimeString('es-CL');
        const line = document.createElement('div');
        line.className = `log-line ${type}`;
        line.innerText = `[${time}] ${msg}`;
        
        consoleLogs.appendChild(line);
        consoleLogs.scrollTop = consoleLogs.scrollHeight;
    }

    clearConsole() {
        const consoleLogs = document.getElementById('console-logs');
        if (consoleLogs) {
            consoleLogs.innerHTML = '<div class="log-line system">[SYS] Terminal limpia. Esperando eventos...</div>';
            this.state.soundManager.playBeep();
        }
    }

    updateLockStatus() {
        // Enforce lock indicators inside sidebar
        const lock2 = document.getElementById('lock-step-2');
        const lock3 = document.getElementById('lock-step-3');
        const lock4 = document.getElementById('lock-step-4');
        const lock5 = document.getElementById('lock-step-5');
        const lock6 = document.getElementById('lock-step-6');

        if (lock2) lock2.innerText = this.state.packingListApproved ? '🔓' : '🔒';
        if (lock3) lock3.innerText = this.state.activeFolio ? '🔓' : '🔒';
        if (lock4) lock4.innerText = this.state.cuadraturaCompleted ? '🔓' : '🔒';
        if (lock5) lock5.innerText = this.state.overlayDetectionsGenerated ? '🔓' : '🔒';
        
        const selected = this.state.boxes.filter(b => b.status === 'selected' || b.status === 'approved' || b.status === 'rejected');
        if (lock6) lock6.innerText = selected.length >= 4 ? '🔓' : '🔒';
    }

    resetAll() {
        this.state.activeFolio = null;
        this.state.activePackingList = null;
        this.state.packingListApproved = false;
        this.state.capturedFaces = { A: false, B: false, C: false, D: false };
        this.state.physicalBoxCount = 0;
        this.state.cuadraturaCompleted = false;
        this.state.cuadraturaAdjusted = false;
        this.state.overlayDetectionsGenerated = false;
        this.state.boxes = [];
        this.state.selectedBoxId = null;
        this.state.blindLevelSelected = null;
        this.state.blindBoxSelectedId = null;
        this.state.currentExtractionIndex = 0;
        this.state.scannedVerificationError = false;

        // Reset dropdown
        document.getElementById('select-packing-list').value = '';
        document.getElementById('plist-preview-container').style.display = 'none';
        document.getElementById('btn-approve-plist').disabled = true;
        const tbodyPallets = document.getElementById('td-pallets-list-tbody');
        if (tbodyPallets) tbodyPallets.innerHTML = '';

        const tbodyProductores = document.getElementById('td-productores-summary-tbody');
        if (tbodyProductores) tbodyProductores.innerHTML = '';

        // Reset input barcodes
        document.getElementById('input-barcode').value = '';
        
        // Reset header details
        document.getElementById('header-folio').innerText = "NO ASIGNADO";
        document.getElementById('header-plist').innerText = "SIN CARGAR";
        
        const statusBadge = document.getElementById('header-status');
        statusBadge.className = "status-tag locked";
        statusBadge.innerText = "BLOQUEADO";

        // Reset Step 3 capture thumbnails and labels
        const faces = ['A', 'B', 'C', 'D'];
        const faceNames = { A: 'Frontal', B: 'Lateral', C: 'Posterior', D: 'Lateral Opuesta' };
        faces.forEach(face => {
            const label = document.getElementById(`cap-label-${face}`);
            if (label) label.innerText = `CARA ${face} (${faceNames[face]})`;
            
            const item = document.getElementById(`cap-face-${face}`);
            if (item) item.classList.remove('done');
            
            const status = document.getElementById(`cap-status-${face}`);
            if (status) status.innerText = "Pendiente";
            
            const thumb = document.getElementById(`thumb-${face}`);
            if (thumb) thumb.innerHTML = '';
        });
        
        document.getElementById('vision-cnt-theoretical').innerText = '--';
        document.getElementById('vision-cnt-physical').innerText = '--';
        document.getElementById('cuadratura-alert-box').className = "alert-box-neutral";
        document.getElementById('cuadratura-alert-title').innerText = "Esperando Toma Fotográfica";
        document.getElementById('cuadratura-alert-desc').innerText = "Inicie la toma de fotos de las 4 caras para efectuar la cuadratura física contra la planilla del ERP.";
        document.getElementById('pane-error-cuadratura').style.display = 'none';

        // Reset coupling cards
        const couplingCard = document.getElementById('coupling-card');
        const couplingPulse = document.getElementById('coupling-pulse');
        const couplingText = document.getElementById('coupling-text');
        couplingCard.style.borderColor = 'var(--color-border)';
        couplingPulse.className = 'circle-pulse orange';
        couplingText.innerText = "Esperando Lectura de Folio Físico";

        // Reset blind levels select
        document.getElementById('select-blind-level').value = '';
        
        // Hide packing list boxes accordion
        document.getElementById('plist-boxes-accordion').style.display = 'none';

        this.setStep(1);
        this.clearConsole();
        this.logConsole("[SISTEMA] Reseteo completo. Todo el estado de sesión ha sido purgado.");
    }

    // --- STEP 7 LOGIC: HISTORY MANAGEMENT ---
    loadHistoryView() {
        const body = document.getElementById('history-table-body');
        const emptyMsg = document.getElementById('history-empty-msg');
        
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem('prize_sag_inspections')) || [];
        } catch (e) {
            console.error('Error loading history', e);
        }

        body.innerHTML = '';

        if (history.length === 0) {
            emptyMsg.style.display = 'block';
            document.getElementById('history-table').style.display = 'none';
            return;
        }

        emptyMsg.style.display = 'none';
        document.getElementById('history-table').style.display = 'table';

        history.forEach(rec => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--color-border)';
            
            const approved = rec.samples.filter(s => s.evalState === 'APPROVED').length;
            const totalSamples = rec.samples.length;
            const dictamenClass = rec.dictamen === 'APROBADO' ? 'text-green' : 'text-red';

            tr.innerHTML = `
                <td style="padding:10px; font-size:0.85rem;">${rec.date}</td>
                <td style="padding:10px; font-family:var(--font-mono); font-weight:700;">${rec.folio}</td>
                <td style="padding:10px;">${rec.lote}</td>
                <td style="padding:10px; font-size:0.85rem;">${rec.inspector}</td>
                <td style="padding:10px; text-align:center;">${approved}/${totalSamples} aprobadas</td>
                <td style="padding:10px; font-weight:700;" class="${dictamenClass}">${rec.dictamen}</td>
                <td style="padding:10px; text-align:right;">
                    <button class="btn btn-small btn-primary mr-sm" onclick="app.showHistoryAct('${rec.id}')">Ver Acta</button>
                    <button class="btn btn-small btn-outline-red" onclick="app.deleteHistoryItem('${rec.id}')">Eliminar</button>
                </td>
            `;
            body.appendChild(tr);
        });
    }

    showHistoryAct(recId) {
        let history = JSON.parse(localStorage.getItem('prize_sag_inspections')) || [];
        const rec = history.find(r => r.id === recId);
        if (!rec) return;

        // Populate certificate modal with historic record
        document.getElementById('cert-no').innerText = rec.id.split('-')[1].slice(-4);
        document.getElementById('cert-date').innerText = rec.date.split(' ')[0];
        document.getElementById('cert-folio-id').innerText = rec.folio;
        document.getElementById('cert-plist-id').innerText = rec.lote;
        document.getElementById('cert-variedad').innerText = rec.variedad;
        document.getElementById('cert-calibre').innerText = rec.calibre;
        document.getElementById('cert-total-cajas').innerText = rec.totalCajas;
        document.getElementById('cert-inspector-sig').innerText = rec.inspector;

        // Build sample table
        const tbody = document.getElementById('cert-muestra-tbody');
        tbody.innerHTML = '';
        rec.samples.forEach(box => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="font-mono text-bold">${box.id}</td>
                <td>Nivel ${box.id.substring(1,3)}</td>
                <td>${box.type === 'interior' ? 'Interior (Ciega)' : 'Exterior'}</td>
                <td class="font-mono">${box.boxCode}</td>
                <td class="text-bold ${box.evalState === 'APPROVED' ? 'text-green' : 'text-red'}">${box.evalState === 'APPROVED' ? 'APROBADO' : 'RECHAZADO FITOSANITARIO'}</td>
            `;
            tbody.appendChild(tr);
        });

        // Dictamen Final Box styling
        const dictBox = document.getElementById('cert-dictamen-pane');
        const dictVal = document.getElementById('cert-dictamen-val');
        
        if (rec.dictamen === 'RECHAZADO') {
            dictBox.style.borderColor = 'var(--color-danger)';
            dictBox.style.backgroundColor = 'rgba(231, 76, 60, 0.05)';
            dictVal.className = "cert-result text-red text-bold";
            dictVal.innerText = "LOTE RECHAZADO - INGRESO BLOQUEADO";
            dictBox.querySelector('p').innerText = "Se detectó presencia de plaga en el muestreo. El lote completo debe ser re-procesado o fumigado.";
        } else {
            dictBox.style.borderColor = '#22c55e';
            dictBox.style.backgroundColor = '#f0fdf4';
            dictVal.className = "cert-result text-green text-bold";
            dictVal.innerText = "APROBADO PARA EXPORTACIÓN SAG";
            dictBox.querySelector('p').innerText = "El lote cumple con las exigencias del mercado de destino y las normativas fitosanitarias vigentes.";
        }

        this.state.soundManager.playBeep();
        document.getElementById('modal-acta-sag').style.display = 'flex';
    }

    deleteHistoryItem(recId) {
        if (!confirm("¿Está seguro de que desea eliminar este registro del historial?")) return;

        let history = JSON.parse(localStorage.getItem('prize_sag_inspections')) || [];
        history = history.filter(r => r.id !== recId);
        localStorage.setItem('prize_sag_inspections', JSON.stringify(history));
        
        this.state.soundManager.playBeep();
        this.loadHistoryView();
        this.logConsole(`[HISTORIAL] Registro ${recId} eliminado.`);
    }

    exportHistoryJSON() {
        let history = localStorage.getItem('prize_sag_inspections') || '[]';
        
        const blob = new Blob([history], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `historial_inspecciones_sag_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.state.soundManager.playBeep();
        this.logConsole("[HISTORIAL] Historial exportado como archivo JSON.");
    }

    clearHistory() {
        if (!confirm("⚠ ALERTA CRÍTICA\n\n¿Está seguro de que desea purgar COMPLETAMENTE el historial de inspecciones? Esta acción no se puede deshacer.")) return;

        localStorage.removeItem('prize_sag_inspections');
        this.state.soundManager.playBuzzer();
        this.loadHistoryView();
        this.logConsole("[HISTORIAL] Todo el historial de LocalStorage ha sido purgado.");
    }
}

// Instantiate and expose globally
const app = new AppController();
window.addEventListener('DOMContentLoaded', () => {
    app.init();
});
