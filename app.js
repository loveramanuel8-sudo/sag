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

    // Pre-captured database for Vision and IA
    palletPhotosDatabase: {}, // folio -> { A: dataUrl, B: dataUrl, C: dataUrl, D: dataUrl }
    palletBoxesDatabase: {},  // folio -> Array of boxes
    palletCuadraturaDatabase: {}, // folio -> { completed: bool, adjusted: bool, theoretical: int, physical: int }

    // Captured faces (legacy, but keep for compatibility or reset)
    capturedFaces: {
        A: true,
        B: true,
        C: true,
        D: true
    },
    
    // Camera state
    cameraActiveFace: 'A',
    webcamStream: null,
    capturedPhotos: {},
    currentlyEvaluatingBoxId: null,
    
    // Conteo & Cuadratura
    physicalBoxCount: 0,
    cuadraturaCompleted: false,
    cuadraturaAdjusted: false,

    // Step 4 state
    overlayDetectionsGenerated: false,
    
    // Boxes database for the current pallet
    boxes: [], // Will store all 184 box models of the current activeFolio
    
    // Inspector Selection
    inspectorActiveFace: 'A',
    selectedBoxId: null,
    blindLevelSelected: null,
    blindBoxSelectedId: null,
    
    // Physical Inspection
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

// --- Pallet Mock Photo Database Generator ---
function generatePalletMockPhotos(folio) {
    const photos = {};
    const faces = ['A', 'B', 'C', 'D'];
    const faceNames = { A: 'Frontal', B: 'Lateral D', C: 'Posterior', D: 'Lateral I' };
    
    faces.forEach(face => {
        // Create canvas dynamically to generate a realistic pallet photo mockup
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        
        // Background gradient
        const grad = ctx.createLinearGradient(0, 0, 0, 600);
        if (face === 'A') {
            grad.addColorStop(0, '#1e293b');
            grad.addColorStop(1, '#0f172a');
        } else if (face === 'B') {
            grad.addColorStop(0, '#0f172a');
            grad.addColorStop(1, '#1e293b');
        } else if (face === 'C') {
            grad.addColorStop(0, '#1e1b4b');
            grad.addColorStop(1, '#0f172a');
        } else {
            grad.addColorStop(0, '#090d16');
            grad.addColorStop(1, '#1e293b');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 400, 600);
        
        // Draw wood pallet base
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(0, 570, 400, 30);
        ctx.fillStyle = '#5c3a1a';
        ctx.fillRect(0, 570, 400, 3);
        
        // Draw exposed boxes rows (outline)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1.5;
        for (let y = 30; y < 570; y += 45) {
            // Draw boxes
            ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
            ctx.fillRect(35, y, 155, 38);
            ctx.strokeRect(35, y, 155, 38);
            
            ctx.fillRect(210, y, 155, 38);
            ctx.strokeRect(210, y, 155, 38);
            
            // Draw a white barcode label representation on each box
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(150, y + 10, 30, 18);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(153, y + 12, 2, 14);
            ctx.fillRect(157, y + 12, 4, 14);
            ctx.fillRect(163, y + 12, 1, 14);
            ctx.fillRect(166, y + 12, 3, 14);
            ctx.fillRect(171, y + 12, 2, 14);

            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(220, y + 10, 30, 18);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(223, y + 12, 3, 14);
            ctx.fillRect(228, y + 12, 1, 14);
            ctx.fillRect(231, y + 12, 4, 14);
            ctx.fillRect(237, y + 12, 2, 14);
            ctx.fillRect(241, y + 12, 2, 14);
        }
        
        // Green horizontal strapping bands (zunchos)
        ctx.fillStyle = 'rgba(39, 174, 96, 0.7)';
        ctx.fillRect(0, 120, 400, 6);
        ctx.fillRect(0, 230, 400, 6);
        ctx.fillRect(0, 340, 400, 6);
        ctx.fillRect(0, 450, 400, 6);
        
        // Cardboard corner boards (esquineros)
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(10, 0, 16, 570);
        ctx.fillRect(374, 0, 16, 570);
        
        // Watermark texts
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.font = '900 24px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PRIZE SMART VISION', 200, 95);
        ctx.fillText('ESTACIÓN INTEGRAL IA', 200, 435);
        
        ctx.fillStyle = 'rgba(58, 124, 165, 0.85)';
        ctx.font = 'bold 20px Outfit, sans-serif';
        ctx.fillText(`PALLET FOLIO: ${folio}`, 200, 290);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.font = '600 15px Outfit, sans-serif';
        ctx.fillText(`Cara ${face} (${faceNames[face]})`, 200, 320);
        
        const timestamp = new Date().toLocaleString('es-CL');
        ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText(`✔ PROCESADO POR IA - ${timestamp}`, 200, 545);
        
        photos[face] = canvas.toDataURL('image/jpeg');
    });
    return photos;
}

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
        // Enforce validations to prevent moving ahead illegally (skip for Historial step 5)
        if (stepNum !== 5) {
            if (stepNum > 1 && !this.state.packingListApproved) {
                this.alertNoPermission("Debe aprobar y habilitar el Packing List por la Contraparte SAG en el Paso 1.");
                return;
            }
            if (stepNum > 2 && !this.isVisionDbCuadraturaCompleted()) {
                this.alertNoPermission("Debe resolver todos los descuadres en la Base de Datos de Fotos e IA (Paso 2) antes de continuar.");
                return;
            }
            if (stepNum > 3) {
                // Count inspected pallets and their selected boxes
                const inspectedFolios = this.state.sapPalletSample;
                if (inspectedFolios.length === 0) {
                    this.alertNoPermission("Debe seleccionar al menos 1 pallet para inspección en la Tablet (Paso 3).");
                    return;
                }
                // Check that all selected pallets have at least 4 boxes selected
                for (const f of inspectedFolios) {
                    const boxes = this.state.palletBoxesDatabase[f] || [];
                    const selected = boxes.filter(b => b.status === 'selected' || b.status === 'approved' || b.status === 'rejected').length;
                    if (selected < 4) {
                        this.alertNoPermission(`El Inspector SAG debe seleccionar al menos 4 cajas para el Pallet ${f} en la tablet (Paso 3).`);
                        return;
                    }
                }
            }
        }

        // Change step
        this.state.activeStep = stepNum;
        
        // Update sidebar UI classes
        for (let i = 1; i <= 5; i++) {
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
            this.loadVisionDbView();
        } else if (stepNum === 3) {
            this.loadInspectorTabletView();
        } else if (stepNum === 4) {
            this.loadPhysicalVerificationView();
        } else if (stepNum === 5) {
            this.loadHistoryView();
        }
    }

    isVisionDbCuadraturaCompleted() {
        if (!this.state.activePackingList) return false;
        // Verify if all pallets in the packing list have a completed cuadratura (no discrepancies)
        const database = this.state.palletCuadraturaDatabase;
        return Object.values(database).every(status => status.completed);
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

        // Initialize pre-captured databases for all pallets in the Packing List
        this.state.palletPhotosDatabase = {};
        this.state.palletBoxesDatabase = {};
        this.state.palletCuadraturaDatabase = {};
        
        data.palletsList.forEach(p => {
            this.state.palletPhotosDatabase[p.folio] = generatePalletMockPhotos(p.folio);
            this.state.palletBoxesDatabase[p.folio] = generatePalletBoxes(p.folio, key);
            
            // Set up default cuadratura: default is matching except for test discrepancy
            const expectedCount = this.state.palletBoxesDatabase[p.folio].length;
            let physicalCount = expectedCount;
            if (key === 'solicitud_5345_error' && p.folio === '1020006903') {
                physicalCount = 180; // Discrepancy for testing
            }
            
            this.state.palletCuadraturaDatabase[p.folio] = {
                completed: physicalCount === expectedCount,
                adjusted: false,
                theoretical: expectedCount,
                physical: physicalCount
            };
        });

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
        
        // Auto-navigate
        this.setStep(2);
    }

    // --- STEP 2 LOGIC: BASE DE DATOS DE VISIÓN E IA ---
    loadVisionDbView() {
        const grid = document.getElementById('db-pallets-grid');
        if (!grid) return;

        grid.innerHTML = '';
        
        if (!this.state.activePackingList) {
            grid.innerHTML = '<div class="text-center text-muted p-md">No hay datos de lote cargados.</div>';
            return;
        }

        const pallets = this.state.activePackingList.palletsList || [];
        const btnApprove = document.getElementById('btn-approve-db');
        
        let allCompleted = true;

        pallets.forEach(p => {
            const photos = this.state.palletPhotosDatabase[p.folio] || {};
            const cuadratura = this.state.palletCuadraturaDatabase[p.folio] || { completed: true, theoretical: p.cajas, physical: p.cajas };
            
            if (!cuadratura.completed) {
                allCompleted = false;
            }

            const card = document.createElement('div');
            card.className = 'card p-md';
            card.style.border = cuadratura.completed ? '1px solid var(--color-border)' : '2px solid var(--color-danger)';
            card.style.background = 'var(--color-bg-card-hover)';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.gap = '10px';

            const statusClass = cuadratura.completed ? 'approved' : 'rejected';
            const statusText = cuadratura.completed ? '✔️ CUADRADO' : '🚨 DESCUADRE';

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--color-border); padding-bottom: 6px;">
                    <span class="font-mono text-bold text-accent" style="font-size:1.1rem;">Folio: ${p.folio}</span>
                    <span class="badge-item-status ${statusClass}" style="font-size:0.7rem; padding: 2px 6px;">${statusText}</span>
                </div>
                
                <div style="font-size:0.8rem; color:var(--color-text-muted); display:flex; flex-direction:column; gap:4px;">
                    <span><strong>Productor:</strong> ${p.productor}</span>
                    <span><strong>Calificación CSG:</strong> <span class="font-mono">${p.csg}</span></span>
                    <span><strong>Cajas ERP (Teórico):</strong> <span class="font-mono text-bold text-accent">${cuadratura.theoretical}</span></span>
                    <span><strong>Físico (Conteo IA):</strong> <span class="font-mono text-bold ${cuadratura.completed ? 'text-green' : 'text-red'}">${cuadratura.physical}</span></span>
                </div>

                <!-- 4 Faces thumbnails preview from database -->
                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 4px 0;">
                    <div style="border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow:hidden; aspect-ratio: 2/3; position:relative;">
                        <img src="${photos.A}" style="width:100%; height:100%; object-fit:cover;">
                        <span style="position:absolute; bottom:2px; left:2px; font-size:0.55rem; background:rgba(0,0,0,0.8); color:#fff; padding:1px 3px; border-radius:2px; font-weight:800;">A</span>
                    </div>
                    <div style="border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow:hidden; aspect-ratio: 2/3; position:relative;">
                        <img src="${photos.B}" style="width:100%; height:100%; object-fit:cover;">
                        <span style="position:absolute; bottom:2px; left:2px; font-size:0.55rem; background:rgba(0,0,0,0.8); color:#fff; padding:1px 3px; border-radius:2px; font-weight:800;">B</span>
                    </div>
                    <div style="border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow:hidden; aspect-ratio: 2/3; position:relative;">
                        <img src="${photos.C}" style="width:100%; height:100%; object-fit:cover;">
                        <span style="position:absolute; bottom:2px; left:2px; font-size:0.55rem; background:rgba(0,0,0,0.8); color:#fff; padding:1px 3px; border-radius:2px; font-weight:800;">C</span>
                    </div>
                    <div style="border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow:hidden; aspect-ratio: 2/3; position:relative;">
                        <img src="${photos.D}" style="width:100%; height:100%; object-fit:cover;">
                        <span style="position:absolute; bottom:2px; left:2px; font-size:0.55rem; background:rgba(0,0,0,0.8); color:#fff; padding:1px 3px; border-radius:2px; font-weight:800;">D</span>
                    </div>
                </div>
                
                ${!cuadratura.completed ? `
                <div class="warning-alert-red" style="padding:10px; margin-top:4px; font-size:0.75rem; border-radius:var(--radius-sm); display:flex; flex-direction:column; gap:6px; background: rgba(230,95,43,0.08);">
                    <strong style="color:var(--color-danger); font-size:0.75rem;">ACCIÓN CORRECTIVA OPERATIVA REQUERIDA:</strong>
                    <span>La cuadratura detectó un descuadre físico. El ERP declara ${cuadratura.theoretical} pero la IA contó ${cuadratura.physical} cajas.</span>
                    <div style="display:flex; gap:6px; margin-top:2px;">
                        <button class="btn btn-small btn-accent" onclick="app.adjustPalletERP('${p.folio}')" style="font-size:0.7rem; padding:4px 8px; flex:1;">Ajustar ERP (Reemitir)</button>
                        <button class="btn btn-small btn-outline-red" onclick="app.adjustPalletPhysical('${p.folio}')" style="font-size:0.7rem; padding:4px 8px; flex:1; border-color:var(--color-danger); color:var(--color-danger);">Reacomodar Físico</button>
                    </div>
                </div>
                ` : cuadratura.adjusted ? `
                <div style="font-size:0.7rem; color:var(--color-primary); font-weight:800; background:rgba(60,138,72,0.1); padding:6px; border-radius:4px; text-align:center; border: 1px solid var(--color-primary);">
                    ✓ RESOLUCIÓN APLICADA Y CUADRADA
                </div>
                ` : `
                <div style="font-size:0.7rem; color:var(--color-text-muted); text-align:center; padding:6px; background: rgba(255,255,255,0.02); border-radius:4px; border:1px solid rgba(255,255,255,0.05);">
                    ✓ Pallet cuadrado en línea de Visión
                </div>
                `}
            `;
            grid.appendChild(card);
        });

        if (btnApprove) {
            btnApprove.disabled = !allCompleted;
        }

        // Enable sidebar lock step 3 if all completed
        const lock3 = document.getElementById('lock-step-3');
        if (lock3) lock3.innerText = allCompleted ? '🔓' : '🔒';
    }

    adjustPalletERP(folio) {
        const cuadratura = this.state.palletCuadraturaDatabase[folio];
        if (!cuadratura) return;

        // Set theoretical equal to physical
        cuadratura.theoretical = cuadratura.physical;
        cuadratura.completed = true;
        cuadratura.adjusted = true;

        // Update the active packing list cajas count total
        let totalCajas = 0;
        this.state.activePackingList.palletsList.forEach(p => {
            const cu = this.state.palletCuadraturaDatabase[p.folio];
            totalCajas += cu ? cu.theoretical : p.cajas;
        });
        this.state.activePackingList.cajas = totalCajas;

        // Re-generate boxes for this pallet to match 180 boxes
        const boxes = this.state.palletBoxesDatabase[folio];
        if (boxes) {
            // Remove level 12 boxes from perimeter (4 boxes)
            this.state.palletBoxesDatabase[folio] = boxes.filter(b => b.level !== 12 || b.type !== 'exterior');
        }

        this.state.soundManager.playBeep();
        this.logConsole(`[CONTRAPARTE SAG] Planilla reemitida en ERP. Pallet ${folio} ajustado a ${cuadratura.physical} cajas.`);
        this.loadVisionDbView();
    }

    adjustPalletPhysical(folio) {
        const cuadratura = this.state.palletCuadraturaDatabase[folio];
        if (!cuadratura) return;

        // Set physical equal to theoretical (re-arrange stowing)
        cuadratura.physical = cuadratura.theoretical;
        cuadratura.completed = true;
        cuadratura.adjusted = true;

        this.state.soundManager.playBeep();
        this.logConsole(`[OPERADOR] Cajas reacomodadas en pallet físico ${folio}. Conteo verificado a ${cuadratura.theoretical} cajas.`);
        this.loadVisionDbView();
    }

    approveVisionDb() {
        if (!this.isVisionDbCuadraturaCompleted()) {
            alert("No puede aprobar la base de fotos si existen descuadres de cajas en el lote.");
            return;
        }

        // Advance to Step 3
        this.state.soundManager.playBeep();
        this.logConsole(`[VISIÓN DB] Base de datos de fotos del lote aprobada por Inspector.`);
        this.setStep(3);
    }

    // Stubs for legacy hooks or camera modal compatibility
    renderSapRequestedPalletsList() {}
    stopCamera() {
        this.closeModal('modal-camera-capture');
    }
    snapPhoto() {}
    handleCameraFileSelect() {}

    goToTablet() {
        this.setStep(5);
    }

    // --- STEP 3 LOGIC: TABLET INSPECTOR (MULTI-PALLET & BOX SELECTOR) ---
    changeInspectorFace(face) {
        this.state.inspectorActiveFace = face;
        
        // Update tabs
        document.querySelectorAll('.face-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        const tabEl = document.getElementById(`tab-face-${face}`);
        if (tabEl) tabEl.classList.add('active');
        
        const faceLbl = document.getElementById('active-inspector-face-lbl');
        if (faceLbl) {
            faceLbl.innerText = `CARA ${face} (${face === 'A' ? 'Frontal' : face === 'B' ? 'Lateral D' : face === 'C' ? 'Posterior' : 'Lateral I'})`;
        }

        this.loadInspectorPalletView();
        this.state.soundManager.playBeep();
    }

    loadInspectorTabletView() {
        const list = document.getElementById('tablet-pallets-list');
        if (!list) return;

        list.innerHTML = '';

        if (!this.state.activePackingList) {
            list.innerHTML = '<div class="text-center text-muted p-md">No hay datos de lote.</div>';
            return;
        }

        const pallets = this.state.activePackingList.palletsList || [];
        
        // Ensure activeFolio is set to something in the list if empty
        if (!this.state.activeFolio && pallets.length > 0) {
            this.state.activeFolio = pallets[0].folio;
        }

        pallets.forEach(p => {
            const boxes = this.state.palletBoxesDatabase[p.folio] || [];
            const selectedBoxes = boxes.filter(b => b.status === 'selected' || b.status === 'approved' || b.status === 'rejected');
            
            const isInspected = this.state.sapPalletSample.includes(p.folio);
            
            const item = document.createElement('div');
            item.className = 'pallet-list-item' + (this.state.activeFolio === p.folio ? ' active' : '');
            item.style.padding = '8px 12px';
            item.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            item.style.cursor = 'pointer';

            item.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                    <div style="display:flex; align-items:center; gap:8px; flex:1;" onclick="app.selectInspectorActivePallet('${p.folio}')">
                        <input type="checkbox" class="pallet-chk-select" data-folio="${p.folio}" ${isInspected ? 'checked' : ''} onchange="app.togglePalletInspection(event, '${p.folio}')" style="cursor:pointer;">
                        <div style="display:flex; flex-direction:column; margin-left:4px;">
                            <span class="font-mono text-bold text-accent" style="font-size:0.95rem;">${p.folio}</span>
                            <span style="font-size:0.7rem; color:var(--color-text-muted);">
                                Muestreadas: <span class="font-mono ${selectedBoxes.length >= 4 ? 'text-green text-bold' : 'text-warning'}">${selectedBoxes.length}/4</span> cajas
                            </span>
                        </div>
                    </div>
                    <div onclick="app.selectInspectorActivePallet('${p.folio}')">
                        ${selectedBoxes.length >= 4 ? '<span class="badge-item-status approved" style="font-size:0.6rem; padding:2px 5px;">Listo</span>' : '<span class="badge-item-status pending" style="font-size:0.6rem; padding:2px 5px;">Falta</span>'}
                    </div>
                </div>
            `;
            list.appendChild(item);
        });

        // Update active pallet visual indicator label
        const titleLbl = document.getElementById('active-inspector-pallet-lbl');
        if (titleLbl) {
            titleLbl.innerText = this.state.activeFolio;
        }

        this.loadInspectorPalletView();
    }

    selectInspectorActivePallet(folio) {
        this.state.activeFolio = folio;
        this.loadInspectorTabletView();
    }

    togglePalletInspection(event, folio) {
        event.stopPropagation();
        const checked = event.target.checked;
        if (checked) {
            if (!this.state.sapPalletSample.includes(folio)) {
                this.state.sapPalletSample.push(folio);
            }
        } else {
            this.state.sapPalletSample = this.state.sapPalletSample.filter(f => f !== folio);
            // Revert boxes back to initial state
            const boxes = this.state.palletBoxesDatabase[folio] || [];
            boxes.forEach(b => {
                const origSuggested = b.id.includes('N04-A-C1') || b.id.includes('N07-B-C2') || b.id.includes('N11-C-C1') || b.id.includes('N02-D-C2');
                b.status = origSuggested ? 'suggested' : 'unselected';
                b.manualReadConfirmed = false;
            });
        }
        this.state.soundManager.playBeep();
        this.loadInspectorTabletView();
    }

    loadInspectorPalletView() {
        const container = document.getElementById('bounding-boxes-container');
        if (!container) return;
        container.innerHTML = '';

        const activeFolio = this.state.activeFolio;
        if (!activeFolio) return;

        const face = this.state.inspectorActiveFace;
        const boxes = this.state.palletBoxesDatabase[activeFolio] || [];

        // Set photo background from database
        const bg = document.getElementById('pallet-image-bg');
        if (bg) {
            const photos = this.state.palletPhotosDatabase[activeFolio] || {};
            if (photos[face]) {
                bg.style.backgroundImage = `url(${photos[face]})`;
                bg.style.backgroundSize = 'cover';
                bg.style.backgroundPosition = 'center';
            } else {
                bg.style.backgroundImage = 'linear-gradient(180deg, #1b253b 0%, #0d1322 100%)';
            }
        }

        // Render 12 levels for current face
        for (let lvl = 12; lvl >= 1; lvl--) {
            const levelStr = String(lvl).padStart(2, '0');
            const rowDiv = document.createElement('div');
            rowDiv.className = 'bounding-box-row';

            for (let col = 1; col <= 2; col++) {
                const boxId = `N${levelStr}-${face}-C${col}`;
                const box = boxes.find(b => b.id === boxId);

                if (box) {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'bounding-box-item';
                    itemDiv.id = `box-item-${boxId}`;
                    
                    if (box.status === 'suggested') itemDiv.classList.add('suggested');
                    if (box.status === 'selected') itemDiv.classList.add('selected');
                    if (box.status === 'approved') itemDiv.classList.add('selected');
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
                    const emptyDiv = document.createElement('div');
                    rowDiv.appendChild(emptyDiv);
                }
            }
            container.appendChild(rowDiv);
        }

        this.updateMuestraOverviewPanel();
    }

    handleBoxClick(boxId) {
        const activeFolio = this.state.activeFolio;
        const boxes = this.state.palletBoxesDatabase[activeFolio] || [];
        const box = boxes.find(b => b.id === boxId);
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
            this.logConsole(`[INSPECTOR] Pallet ${activeFolio} - Caja ${boxId} seleccionada para muestra.`);
        } else if (box.status === 'selected') {
            const origSuggested = boxId.includes('N04-A-C1') || boxId.includes('N07-B-C2') || boxId.includes('N11-C-C1') || boxId.includes('N02-D-C2');
            box.status = origSuggested ? 'suggested' : 'unselected';
            this.state.soundManager.playBeep();
            this.logConsole(`[INSPECTOR] Pallet ${activeFolio} - Caja ${boxId} deseleccionada.`);
        }

        this.state.selectedBoxId = box.status === 'selected' ? boxId : null;
        
        this.loadInspectorPalletView();
        this.updateSelectionDetails(boxId);
    }

    updateSelectionDetails(boxId) {
        const container = document.getElementById('selection-details-data');
        if (!container) return;

        if (!boxId) {
            container.innerHTML = `
                <div class="empty-selection-msg">
                    <span>Toque una caja en el pallet de la izquierda para ver su trazabilidad o programar muestra.</span>
                </div>
            `;
            return;
        }

        const activeFolio = this.state.activeFolio;
        const boxes = this.state.palletBoxesDatabase[activeFolio] || [];
        const box = boxes.find(b => b.id === boxId);
        if (!box) return;

        let statusText = "No Seleccionada";
        let statusClass = "text-muted";
        if (box.status === 'suggested') { statusText = "Sugerida Algoritmo (Aleatoria)"; statusClass = "text-green"; }
        if (box.status === 'selected') { statusText = "Seleccionada Inspector"; statusClass = "text-accent"; }
        if (box.status === 'approved') { statusText = "Aprobada Físico"; statusClass = "text-green"; }
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

    openManualScanModal(boxId) {
        this.state.soundManager.playBuzzer();
        
        const activeFolio = this.state.activeFolio;
        const boxes = this.state.palletBoxesDatabase[activeFolio] || [];
        const box = boxes.find(b => b.id === boxId);
        if (!box) return;

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

        const activeFolio = this.state.activeFolio;
        const boxes = this.state.palletBoxesDatabase[activeFolio] || [];
        const box = boxes.find(b => b.id === coord);
        if (!box) return;
        
        if (inputVal.toUpperCase() !== expected.toUpperCase()) {
            this.state.soundManager.playBuzzer();
            alert("Error: El código Data Matrix ingresado no concuerda con la base de datos de trazabilidad del lote.");
            return;
        }

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

    loadBlindBoxesForLevel(lvlVal) {
        const buttonsContainer = document.getElementById('blind-boxes-buttons-container');
        const grid = document.getElementById('blind-buttons-grid');
        const helper = document.getElementById('blind-helper-directions');

        if (!buttonsContainer || !grid) return;

        if (!lvlVal) {
            buttonsContainer.style.display = 'none';
            if (helper) helper.style.display = 'none';
            return;
        }

        this.state.blindLevelSelected = parseInt(lvlVal);
        const levelStr = String(lvlVal).padStart(2, '0');

        grid.innerHTML = '';
        
        const activeFolio = this.state.activeFolio;
        const boxes = this.state.palletBoxesDatabase[activeFolio] || [];
        
        for (let i = 1; i <= 8; i++) {
            const blindId = `N${levelStr}-INT${i}`;
            const box = boxes.find(b => b.id === blindId);
            
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
        if (helper) helper.style.display = 'none';
        this.state.soundManager.playBeep();
    }

    selectBlindBox(blindId) {
        this.state.blindBoxSelectedId = blindId;
        
        document.querySelectorAll('.btn-blind-box').forEach(btn => {
            if (btn.innerText === `INT ${blindId.split('INT')[1]}`) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });

        const activeFolio = this.state.activeFolio;
        const boxes = this.state.palletBoxesDatabase[activeFolio] || [];
        const box = boxes.find(b => b.id === blindId);

        const level = this.state.blindLevelSelected;
        const levelStr = String(level).padStart(2, '0');
        const coreIdx = parseInt(blindId.split('INT')[1]);
        const blockingConfig = InteriorBlockingMatrix[coreIdx];
        
        const blockA = `N${levelStr}-${blockingConfig.face}-C${blockingConfig.cols[0]}`;
        const nextCol = blockingConfig.cols[0] === 1 ? 2 : 1;
        const blockB = `N${levelStr}-${blockingConfig.face}-C${nextCol}`;

        const lbl = document.getElementById('blind-box-id-lbl');
        if (lbl) {
            lbl.innerText = `${blindId} (Cod: ${box ? box.boxCode : ''})`;
        }
        
        const blockingList = document.getElementById('blocking-cajas-list');
        if (blockingList) {
            blockingList.innerHTML = `
                <li>Caja Directa Bloqueante: <span class="text-accent">${blockA}</span> (${blockingConfig.description})</li>
                <li>Caja Auxiliar Holgura: <span class="text-warning">${blockB}</span></li>
            `;
        }

        const helper = document.getElementById('blind-helper-directions');
        if (helper) helper.style.display = 'block';
        this.state.soundManager.playBeep();
        this.logConsole(`[CIEGA HELPER] Plan desmontaje generado para ${blindId}. Bloqueantes: ${blockA}, ${blockB}.`);
    }

    addBlindBoxToMuestra() {
        const blindId = this.state.blindBoxSelectedId;
        if (!blindId) return;

        const activeFolio = this.state.activeFolio;
        const boxes = this.state.palletBoxesDatabase[activeFolio] || [];
        const box = boxes.find(b => b.id === blindId);
        if (box) {
            box.status = 'selected';
            this.state.soundManager.playBeep();
            this.logConsole(`[INSPECTOR] Caja Ciega ${blindId} agregada a muestra.`);
            
            const level = box.level;
            const levelStr = String(level).padStart(2, '0');
            const coreIdx = parseInt(blindId.split('INT')[1]);
            const blockingConfig = InteriorBlockingMatrix[coreIdx];
            
            const outerBlockingId = `N${levelStr}-${blockingConfig.face}-C${blockingConfig.cols[0]}`;
            const outerBox = boxes.find(b => b.id === outerBlockingId);
            
            if (outerBox && outerBox.status === 'unselected') {
                outerBox.status = 'suggested';
            }

            this.loadInspectorPalletView();
            this.loadBlindBoxesForLevel(box.level);
        }
    }

    updateMuestraOverviewPanel() {
        const list = document.getElementById('muestra-items-list');
        if (!list) return;
        list.innerHTML = '';

        const activeFolio = this.state.activeFolio;
        if (!activeFolio) return;

        const boxes = this.state.palletBoxesDatabase[activeFolio] || [];
        const selectedBoxes = boxes.filter(b => b.status === 'selected' || b.status === 'approved' || b.status === 'rejected');
        
        document.getElementById('muestra-cnt-selected').innerText = selectedBoxes.length;
        
        const rejected = selectedBoxes.filter(b => b.status === 'rejected').length;
        document.getElementById('muestra-cnt-rejected').innerText = rejected;

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

        // Check if all selected pallets have at least 4 boxes selected
        const inspectedFolios = this.state.sapPalletSample;
        let canValidate = inspectedFolios.length > 0;
        
        for (const f of inspectedFolios) {
            const pBoxes = this.state.palletBoxesDatabase[f] || [];
            const selCount = pBoxes.filter(b => b.status === 'selected' || b.status === 'approved' || b.status === 'rejected').length;
            if (selCount < 4) {
                canValidate = false;
                break;
            }
        }

        const btnNext = document.getElementById('btn-goto-step6');
        if (btnNext) {
            btnNext.disabled = !canValidate;
        }
    }

    goToStep4() {
        this.setStep(4);
    }

    // --- STEP 4 LOGIC: PHYSICAL VERIFICATION SCANNING & REPORT Dictamen ---
    getConsolidatedSelectedBoxes() {
        const list = [];
        const inspectedFolios = this.state.sapPalletSample;
        inspectedFolios.forEach(f => {
            const boxes = this.state.palletBoxesDatabase[f] || [];
            boxes.forEach(b => {
                if (b.status === 'selected' || b.status === 'approved' || b.status === 'rejected') {
                    list.push({
                        ...b,
                        palletFolio: f
                    });
                }
            });
        });
        return list;
    }

    loadPhysicalVerificationView() {
        const instPane = document.getElementById('extraction-instructions-pane');
        const suggestPane = document.getElementById('scan-suggested-hints');
        if (!instPane || !suggestPane) return;

        const selected = this.getConsolidatedSelectedBoxes();
        const pending = selected.filter(b => b.status === 'selected');

        if (pending.length === 0) {
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

        // Update instruction showing all pending boxes in a list
        let pendingListHtml = pending.map(box => `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
                <div>
                    <span class="text-accent font-mono text-bold">${box.palletFolio} - ${box.id}</span>
                    <span style="font-size:0.75rem; color:var(--color-text-muted); margin-left: 10px;">Nivel ${box.level} - Cara ${box.face}</span>
                </div>
                <span class="font-mono text-bold" style="color:var(--color-primary);">${box.boxCode}</span>
            </div>
        `).join('');

        instPane.innerHTML = `
            <div class="extraction-card">
                <span class="badge badge-primary">MUESTRAS PENDIENTES DE ESCANEO</span>
                <p class="small text-muted mt-xs">Pistolee cualquiera de las siguientes cajas seleccionadas de la muestra (en cualquier orden):</p>
                <div style="max-height: 200px; overflow-y: auto; margin-top: 10px; display: flex; flex-direction: column; gap: 4px;">
                    ${pendingListHtml}
                </div>
            </div>
        `;

        // Render fast simulation scan buttons for all pending boxes
        let suggestScanButtons = pending.map(box => `
            <button class="btn-suggested-scan" onclick="app.simulateVerificationScan('${box.boxCode}')" style="margin-right: 6px; margin-top: 6px;">Simular ${box.palletFolio} - ${box.id}</button>
        `).join('');

        suggestPane.innerHTML = `
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${suggestScanButtons}
                <button class="btn-suggested-scan" onclick="app.simulateVerificationScan('8000000000')" style="background-color:rgba(230,95,43,0.1); border-color:var(--color-danger); color:var(--color-danger); margin-top:6px;">Simular Código Erróneo (Error)</button>
            </div>
        `;

        document.getElementById('input-dm-verify').value = '';
        document.getElementById('input-dm-verify').focus();
        document.getElementById('box-evaluation-pane').style.display = 'none';
        
        this.updateActaForm();
    }

    prepareNextPallet(nextFolio) {}

    simulateVerificationScan(code) {
        document.getElementById('input-dm-verify').value = code;
        this.verifyBoxScan();
    }

    verifyBoxScan() {
        const inputVal = document.getElementById('input-dm-verify').value.trim();
        if (inputVal === '') {
            alert("Ingrese o pistolee el código Data Matrix de la caja extraída.");
            return;
        }

        const pending = this.getConsolidatedSelectedBoxes().filter(b => b.status === 'selected');
        if (pending.length === 0) return;

        // Search for a box in the pending sample that matches the scanned code
        const matchedBox = pending.find(b => b.boxCode.toUpperCase() === inputVal.toUpperCase());

        if (!matchedBox) {
            this.state.soundManager.playBuzzer();
            this.state.scannedVerificationError = true;
            this.logConsole(`[SCAN ERROR] Movilizador pistoleó un código incorrecto o fuera de muestra: ${inputVal}.`, 'error');
            alert(`🚨 ERROR DE EXTRACCIÓN (CHICHARRA)\n\nEl operador extrajo una caja que no coincide con ninguna coordenada de la muestra del lote.\n\nCódigo Leído: ${inputVal}\n\nPor favor devuelva la caja errónea y extraiga la correcta.`);
            return;
        }

        // Correct box scan!
        this.state.soundManager.playBeep();
        this.state.scannedVerificationError = false;
        this.logConsole(`[SCAN OK] Pistoleo correcto. Pallet: ${matchedBox.palletFolio}, Caja: ${matchedBox.id}. Código: ${matchedBox.boxCode} verificado.`);

        // Store the ID of the box currently being evaluated
        this.state.currentlyEvaluatingBox = {
            palletFolio: matchedBox.palletFolio,
            id: matchedBox.id
        };

        // Open evaluation window
        document.getElementById('eval-box-id-lbl').innerText = `${matchedBox.palletFolio} - ${matchedBox.id}`;
        document.getElementById('box-evaluation-pane').style.display = 'block';
    }

    evaluateBox(result) {
        const evalBox = this.state.currentlyEvaluatingBox;
        if (!evalBox) return;

        const boxes = this.state.palletBoxesDatabase[evalBox.palletFolio] || [];
        const currentBox = boxes.find(b => b.id === evalBox.id);
        if (!currentBox) return;
        
        currentBox.status = result === 'APPROVED' ? 'approved' : 'rejected';
        currentBox.evalState = result;
        
        this.state.currentlyEvaluatingBox = null;
        
        this.state.soundManager.playBeep();
        this.logConsole(`[SAG INSPECTOR] Pallet ${evalBox.palletFolio} - Caja ${currentBox.id} evaluada. Dictamen: ${result}.`);

        this.loadPhysicalVerificationView();
    }

    updateActaForm() {
        const allSelected = this.getConsolidatedSelectedBoxes().filter(b => b.status === 'approved' || b.status === 'rejected');
        const approved = allSelected.filter(b => b.status === 'approved');
        const rejected = allSelected.filter(b => b.status === 'rejected');

        document.getElementById('acta-folio').innerText = this.state.sapPalletSample.join(', ');
        document.getElementById('acta-plist').innerText = this.state.activePackingList.lote;
        document.getElementById('acta-tot-cajas').innerText = `${this.state.activePackingList.cajas} Cajas (${this.state.activePackingList.pallets} Pallets)`;
        
        const evaluatedCount = approved.length + rejected.length;
        document.getElementById('acta-audited-cnt').innerText = evaluatedCount;
        document.getElementById('acta-rejected-cnt').innerText = rejected.length;

        const dictamenTag = document.getElementById('acta-dictamen');
        if (dictamenTag) {
            const pendingCount = this.getConsolidatedSelectedBoxes().filter(b => b.status === 'selected').length;
            if (pendingCount > 0) {
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
    }

    finalizeInspection() {
        const sigInput = document.getElementById('input-inspector-signature').value.trim();
        if (sigInput === '') {
            this.state.soundManager.playBuzzer();
            alert("Para emitir el certificado oficial del SAG es obligatoria la Firma Digital de Conformidad del inspector.");
            document.getElementById('input-inspector-signature').focus();
            return;
        }

        const allSelected = this.getConsolidatedSelectedBoxes().filter(b => b.status === 'approved' || b.status === 'rejected');
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
        if (tbody) {
            tbody.innerHTML = '';
            allSelected.forEach(box => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="font-mono text-bold">${box.palletFolio} - ${box.id}</td>
                    <td>Nivel ${box.level} - Col ${box.column}</td>
                    <td>${box.type === 'interior' ? 'Interior (Ciega)' : 'Exterior'}</td>
                    <td class="font-mono">${box.obstructedByZuncho && !box.manualReadConfirmed ? 'Lectura manual (' + box.boxCode + ')' : box.boxCode}</td>
                    <td class="text-bold ${box.evalState === 'APPROVED' ? 'text-green' : 'text-red'}">${box.evalState === 'APPROVED' ? 'APROBADO' : 'RECHAZADO FITOSANITARIO'}</td>
                `;
                tbody.appendChild(tr);
            });
        }

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
                palletFolio: box.palletFolio,
                id: box.id,
                type: box.type,
                boxCode: box.boxCode,
                evalState: box.evalState
            }))
        };

        try {
            let history = JSON.parse(localStorage.getItem('prize_sag_inspections')) || [];
            history.unshift(inspectionRecord);
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
        const lock2 = document.getElementById('lock-step-2');
        const lock3 = document.getElementById('lock-step-3');
        const lock4 = document.getElementById('lock-step-4');
        const lock5 = document.getElementById('lock-step-5');

        if (lock2) lock2.innerText = this.state.packingListApproved ? '🔓' : '🔒';
        if (lock3) lock3.innerText = this.isVisionDbCuadraturaCompleted() ? '🔓' : '🔒';
        
        const inspectedFolios = this.state.sapPalletSample;
        let canProceedTo4 = inspectedFolios.length > 0;
        for (const f of inspectedFolios) {
            const pBoxes = this.state.palletBoxesDatabase[f] || [];
            const selCount = pBoxes.filter(b => b.status === 'selected' || b.status === 'approved' || b.status === 'rejected').length;
            if (selCount < 4) {
                canProceedTo4 = false;
                break;
            }
        }
        if (lock4) lock4.innerText = canProceedTo4 ? '🔓' : '🔒';

        const selected = this.getConsolidatedSelectedBoxes();
        const pendingCount = selected.filter(b => b.status === 'selected').length;
        if (lock5) lock5.innerText = (selected.length >= 4 && pendingCount === 0) ? '🔓' : '🔒';
    }

    setTestMode(mode) {
        const formView = document.getElementById('test-form-view');
        const jsonView = document.getElementById('test-json-view');
        const btnForm = document.getElementById('btn-test-tab-form');
        const btnJson = document.getElementById('btn-test-tab-json');

        if (mode === 'form') {
            formView.style.display = 'block';
            jsonView.style.display = 'none';
            btnForm.style.borderBottom = '2px solid var(--color-accent-sag)';
            btnForm.style.color = '#fff';
            btnForm.style.fontWeight = '700';
            btnJson.style.borderBottom = '2px solid transparent';
            btnJson.style.color = 'var(--color-text-muted)';
            btnJson.style.fontWeight = 'normal';
        } else {
            formView.style.display = 'none';
            jsonView.style.display = 'block';
            btnForm.style.borderBottom = '2px solid transparent';
            btnForm.style.color = 'var(--color-text-muted)';
            btnForm.style.fontWeight = 'normal';
            btnJson.style.borderBottom = '2px solid var(--color-accent-sag)';
            btnJson.style.color = '#fff';
            btnJson.style.fontWeight = '700';
        }
    }

    generateLotFromForm() {
        const solicitudNo = document.getElementById('test-form-solicitud').value.trim();
        const lote = document.getElementById('test-form-lote').value.trim();
        const cajas = parseInt(document.getElementById('test-form-cajas').value);
        const pallets = parseInt(document.getElementById('test-form-pallets').value);
        const csg = document.getElementById('test-form-csg').value.trim();
        const nombre = document.getElementById('test-form-productor').value.trim();
        const destinos = document.getElementById('test-form-destinos').value.trim();
        const muestraInput = document.getElementById('test-form-muestra').value.trim();

        if (!solicitudNo || !lote || !cajas || !pallets || !csg || !nombre || !destinos) {
            alert("Por favor rellene todos los campos obligatorios.");
            return;
        }

        // Generate palletsList
        const palletsList = [];
        const averageCajasPerPallet = Math.round(cajas / pallets);
        
        // Parse requested samples
        const sampleIndices = muestraInput.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        const sapMuestra = [];

        // Generate folios
        for (let i = 1; i <= pallets; i++) {
            const indexStr = String(i).padStart(3, '0');
            const folio = `10200072${indexStr}`;
            
            const isSample = sampleIndices.includes(i);
            if (isSample) {
                sapMuestra.push(folio);
            }

            palletsList.push({
                id: i,
                folio: folio,
                csg: csg,
                productor: nombre,
                cajas: i === pallets ? (cajas - (averageCajasPerPallet * (pallets - 1))) : averageCajasPerPallet, // remainder check
                defaultChecked: isSample
            });
        }

        // Fallback sample if none selected
        if (sapMuestra.length === 0) {
            sapMuestra.push(palletsList[0].folio);
            palletsList[0].defaultChecked = true;
        }

        const customData = {
            solicitudNo: solicitudNo,
            lote: lote,
            planta: "PRIZE PILOTO",
            csp: "105634",
            kilos: (cajas * 4.54).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            cajas: cajas,
            pallets: pallets,
            especie: "CEREZAS",
            destinos: destinos,
            sapMuestra: sapMuestra,
            fecha: new Date().toLocaleDateString('es-CL'),
            productores: [
                { especie: "CEREZAS", csg: csg, proceso: "20779", nombre: nombre, cajas: cajas }
            ],
            palletsList: palletsList
        };

        const key = 'solicitud_custom_' + solicitudNo;
        
        // Register in local database
        PackingListMockData[key] = customData;

        // Add to select dropdown if not already there
        const select = document.getElementById('select-packing-list');
        let optionExists = false;
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value === key) {
                optionExists = true;
                break;
            }
        }

        if (!optionExists) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.innerText = `Solicitud SAG Nº ${solicitudNo} (Personalizada: ${lote})`;
            select.appendChild(opt);
        }

        // Select it and load it
        select.value = key;
        this.loadPackingListData(key);

        this.state.soundManager.playBeep();
        this.logConsole(`[SISTEMA] Generado lote desde formulario: Solicitud SAG Nº ${solicitudNo}.`);
        
        alert(`✔ LOTE GENERADO CON ÉXITO\n\nSe ha creado y cargado la Solicitud SAG Nº ${solicitudNo} con ${pallets} pallets y ${cajas} cajas. \n\nFolios de muestra SAP asignados: ${sapMuestra.join(', ')}.`);
        
        // Auto hide test panel
        document.getElementById('test-json-panel').style.display = 'none';
    }

    toggleTestPanel() {
        const panel = document.getElementById('test-json-panel');
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
        }
    }

    loadTestTemplate() {
        const template = {
            solicitudNo: "9090",
            lote: "LOT-9090-TEST",
            planta: "PRIZE PILOTO",
            csp: "109090",
            kilos: "12.500,00",
            cajas: 1840,
            pallets: 10,
            especie: "CEREZAS",
            destinos: "CHINA, ESTADOS UNIDOS, BRASIL",
            sapMuestra: ["1020009001", "1020009003"],
            fecha: new Date().toLocaleDateString('es-CL'),
            productores: [
                { especie: "CEREZAS", csg: "55555", proceso: "99881", nombre: "AGRICOLA LOS ANDES", cajas: 1840 }
            ],
            palletsList: [
                { id: 1, folio: "1020009001", csg: "55555", productor: "AGRICOLA LOS ANDES", cajas: 184, defaultChecked: true },
                { id: 2, folio: "1020009002", csg: "55555", productor: "AGRICOLA LOS ANDES", cajas: 184 },
                { id: 3, folio: "1020009003", csg: "55555", productor: "AGRICOLA LOS ANDES", cajas: 184, defaultChecked: true },
                { id: 4, folio: "1020009004", csg: "55555", productor: "AGRICOLA LOS ANDES", cajas: 184 },
                { id: 5, folio: "1020009005", csg: "55555", productor: "AGRICOLA LOS ANDES", cajas: 184 },
                { id: 6, folio: "1020009006", csg: "55555", productor: "AGRICOLA LOS ANDES", cajas: 184 },
                { id: 7, folio: "1020009007", csg: "55555", productor: "AGRICOLA LOS ANDES", cajas: 184 },
                { id: 8, folio: "1020009008", csg: "55555", productor: "AGRICOLA LOS ANDES", cajas: 184 },
                { id: 9, folio: "1020009009", csg: "55555", productor: "AGRICOLA LOS ANDES", cajas: 184 },
                { id: 10, folio: "1020009010", csg: "55555", productor: "AGRICOLA LOS ANDES", cajas: 184 }
            ]
        };
        document.getElementById('test-json-input').value = JSON.stringify(template, null, 4);
    }

    importCustomTestData() {
        const text = document.getElementById('test-json-input').value.trim();
        if (!text) {
            alert("Por favor, cargue una plantilla o pegue un JSON válido.");
            return;
        }

        try {
            const data = JSON.parse(text);
            
            // Validate required fields
            const required = ['solicitudNo', 'lote', 'planta', 'csp', 'kilos', 'cajas', 'pallets', 'especie', 'destinos', 'sapMuestra', 'fecha', 'productores', 'palletsList'];
            for (const field of required) {
                if (data[field] === undefined) {
                    throw new Error(`Falta el campo requerido: "${field}"`);
                }
            }

            const key = 'solicitud_custom_' + data.solicitudNo;
            
            // Insert into local Mock Database
            PackingListMockData[key] = data;

            // Check if option already exists in dropdown
            const select = document.getElementById('select-packing-list');
            let optionExists = false;
            for (let i = 0; i < select.options.length; i++) {
                if (select.options[i].value === key) {
                    optionExists = true;
                    break;
                }
            }

            if (!optionExists) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.innerText = `Solicitud SAG Nº ${data.solicitudNo} (Personalizada: ${data.lote})`;
                select.appendChild(opt);
            }

            // Select it and load it
            select.value = key;
            this.loadPackingListData(key);

            this.state.soundManager.playBeep();
            this.logConsole(`[SISTEMA] Importado lote de pruebas personalizado: Solicitud SAG Nº ${data.solicitudNo}.`);
            
            alert(`✔ LOTE IMPORTADO CON ÉXITO\n\nSe ha importado y cargado la Solicitud SAG Nº ${data.solicitudNo} con ${data.pallets} pallets y ${data.cajas} cajas de forma dinámica.`);
            
            // Auto hide panel
            document.getElementById('test-json-panel').style.display = 'none';
        } catch (e) {
            console.error("Error parsing test JSON", e);
            alert(`❌ ERROR DE IMPORTACIÓN\n\nEl JSON ingresado contiene errores o campos faltantes.\n\nDetalle: ${e.message}`);
        }
    }

    resetAll() {
        this.stopCamera();
        this.state.activeFolio = null;
        this.state.activePackingList = null;
        this.state.packingListApproved = false;
        this.state.capturedFaces = { A: false, B: false, C: false, D: false };
        this.state.capturedPhotos = {};
        this.state.currentlyEvaluatingBoxId = null;
        this.state.physicalBoxCount = 0;
        this.state.cuadraturaCompleted = false;
        this.state.cuadraturaAdjusted = false;
        this.state.palletBoxesDatabase = {};
        this.state.palletPhotosDatabase = {};
        this.state.palletCuadraturaDatabase = {};
        this.state.sapPalletSample = [];

        const codesListContainer = document.getElementById('decoded-codes-list-container');
        const codesList = document.getElementById('decoded-codes-list');
        if (codesListContainer) codesListContainer.style.display = 'none';
        if (codesList) codesList.innerHTML = '';
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
