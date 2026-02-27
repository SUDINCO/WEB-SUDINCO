import { type CellHookData } from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { PersonDTO, EvaluationDTO } from './contracts';
import type { EquipmentHandover } from './types';

const LOGO_URL = 'https://i.postimg.cc/B6HGbmCz/LOGO-CADENVILL.png';

const formatDate = (dateStr: string | undefined | number) => {
    if (!dateStr) return 'N/A';
    try {
        const date = new Date(dateStr);
         if(isNaN(date.getTime())) return String(dateStr); // if it's already formatted
        // Adjust for timezone issues if it's just a date string without time
        if (typeof dateStr === 'string' && !dateStr.includes('T') && !dateStr.includes(' ')) {
            const adjustedDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
            return format(adjustedDate, 'dd/MM/yyyy', { locale: es });
        }
        return format(date, 'dd/MM/yyyy, HH:mm', { locale: es });
    } catch {
        return String(dateStr); // Return original string if parsing fails
    }
};

const ratings: Record<string, { label: string, color: [number, number, number] }> = {
    NT: { label: "No Tiene", color: [239, 68, 68] },       // red-500
    BA: { label: "Bajo", color: [250, 204, 21] },      // yellow-400
    ED: { label: "En Desarrollo", color: [34, 197, 94] },  // green-500
    TI: { label: "Tiene", color: [20, 184, 166] },       // teal-500
};

export const generateEvaluationPDF = async (worker: PersonDTO, evaluator: PersonDTO, evaluation: EvaluationDTO) => {
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // === HEADER ===
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('EVALUACIÓN DE DESEMPEÑO', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text('FORMULARIO DE RECURSOS HUMANOS', pageWidth / 2, 9, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line(margin, 20, pageWidth - margin, 20);
    let lastY = 22;

    // === DATOS DEL COLABORADOR ===
    doc.setFillColor(224, 224, 224); // light grey
    doc.rect(margin, lastY, pageWidth - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('DATOS DEL COLABORADOR', pageWidth / 2, lastY + 5, { align: 'center' });
    lastY += 7;
    (doc as any).autoTable({
        startY: lastY,
        body: [
            [
                { content: `Cédula: ${worker.cedula}`, styles: { fontStyle: 'bold' } },
                { content: `Nombre: ${worker.nombreCompleto}`, styles: { fontStyle: 'bold' } },
                { content: `Fecha Ingreso: ${formatDate(worker.fechaIngreso)}`, styles: { fontStyle: 'bold' } },
                { content: `Empresa: ${worker.empresa}`, styles: { fontStyle: 'bold' } },
            ],
            [
                { content: `Cargo: ${worker.cargo}`, styles: { fontStyle: 'bold' } },
                { content: `Ubicación: ${worker.ubicacion || 'N/A'}`, styles: { fontStyle: 'bold' } },
                { content: `Departamento: ${worker.departamento}`, styles: { fontStyle: 'bold' } },
                ''
            ]
        ],
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2 },
    });
    lastY = (doc as any).lastAutoTable.finalY;

    // === DATOS DEL EVALUADOR ===
    doc.setFillColor(224, 224, 224);
    doc.rect(margin, lastY, pageWidth - margin * 2, 7, 'F');
    doc.text('DATOS DEL EVALUADOR', pageWidth / 2, lastY + 5, { align: 'center' });
    lastY += 7;
    (doc as any).autoTable({
        startY: lastY,
        body: [[
            { content: `Cédula: ${evaluator.cedula || 'N/A'}`, styles: { fontStyle: 'bold' } },
            { content: `Nombre: ${evaluator.nombreCompleto}`, styles: { fontStyle: 'bold' } },
            { content: `Fecha evaluación: ${formatDate(evaluation.evaluationDate)}`, styles: { fontStyle: 'bold' } },
            { content: `Cargo: ${evaluator.cargo}`, styles: { fontStyle: 'bold' } },
        ]],
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2 },
    });
    lastY = (doc as any).lastAutoTable.finalY;

    // === GRADOS DE EVALUACIÓN ===
    doc.setFillColor(224, 224, 224);
    doc.rect(margin, lastY, pageWidth - margin * 2, 7, 'F');
    doc.text('GRADOS DE EVALUACIÓN', pageWidth / 2, lastY + 5, { align: 'center' });
    lastY += 7;
    const gradesData = [
        ['NT', 'NO TIENE', 'No conoce, ni evidencia comportamientos asociados a la competencia.'],
        ['BA', 'BAJO', 'Muestra destellos en la aplicación de algunos comportamientos asociados a la competencia.'],
        ['ED', 'EN DESARROLLO', 'Demuestra comportamientos asociados a la competencia pero necesita apoyo.'],
        ['TI', 'TIENE', 'Domina con un gran nivel de experticia los comportamientos asociados a la competencia.'],
    ];
    (doc as any).autoTable({
        startY: lastY,
        head: [['ABREVIA', 'CRITERIO', 'DESCRIPCIÓN']],
        body: gradesData,
        theme: 'grid',
        headStyles: { fontStyle: 'bold', halign: 'center', fillColor: [240, 240, 240], textColor: 0, fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold', halign: 'center' }, 1: { cellWidth: 35, fontStyle: 'bold' } },
        didDrawCell: (data: CellHookData) => {
            if (data.section === 'body' && data.column.index === 0) {
                const ratingKey = Array.isArray(data.cell.text) ? data.cell.text[0] : data.cell.text;
                if (ratingKey && ratings[ratingKey]) {
                    doc.setFillColor(...ratings[ratingKey].color);
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                    doc.setTextColor(255, 255, 255);
                }
            }
        }
    });
    lastY = (doc as any).lastAutoTable.finalY;

    // === EVALUATION CRITERIA ===
    const criteria = [
        { key: "conocimientosTecnicos", title: "Conocimientos Técnicos, Experiencia y Habilidades", desc: "Tiene los conocimientos, experiencia y habilidades necesarios para el cargo y desempeñar a cabalidad sus funciones." },
        { key: "calidadTrabajo", title: "Calidad del trabajo", desc: "Se interesa en hacer bien su trabajo cumpliendo estándares de calidad con excelencia, la atención al detalle y cumple objetivos." },
        { key: "cumplimientoPoliticas", title: "Cumplimiento de Políticas, procedimientos y funciones", desc: "Conoce y cumple las políticas y procedimientos de la empresa, Sistema de Gestión Integrado, Manual de funciones, directrices del jefe inmediato y participa activamente en actividades de cumplimiento." },
        { key: "proactividad", title: "Proactividad", desc: "Propone ideas, se anticipa a los problemas y busca mejoras constantemente." },
        { key: "comunicacion", title: "Comunicación y Relaciones Interpersonales", desc: "Transmite, recibe y entiende la información de manera clara, concisa y efectiva. Mantiene buenas relaciones con sus jefes y compañeros de trabajo, saluda, es cortés, mantiene respeto y trabaja en equipo." },
        { key: "integridad", title: "Integridad y Ética", desc: "Es honesto, dice la verdad, reconoce sus errores, sigue las reglas éticas." },
        { key: "adaptabilidad", title: "Adaptabilidad", desc: "Mantiene estabilidad emocional, continúa con actitud positiva, buena predisposición y buen desempeño pese a las circunstancias." },
        { key: "servicioCliente", title: "Servicio al Cliente", desc: "Tiene el deseo de ayudar y servir a sus clientes internos y externos, tiene la capacidad de comprender, apoyar y satisfacer sus necesidades." },
        { key: "compromisoCompania", title: "Compromiso con la Compañía", desc: "Es responsable con sus herramientas de trabajo, cuida los bienes a cargo, optimiza recursos. Llega puntualmente a su lugar de trabajo y no tiene atrasos o faltas injustificadas. Es leal y está predispuesto a dar un esfuerzo extra." },
    ];
    
    let currentX = margin;
    let criteriaY = lastY + 2;
    const boxWidth = (pageWidth - margin * 2 - 8) / 3; // 3 boxes per row, with 4px gap
    const boxHeight = 48; // Adjusted height
    const boxGap = 4;

    criteria.forEach((criterion, index) => {
        if (index > 0 && index % 3 === 0) {
            criteriaY += boxHeight + boxGap; // Move to next row
            currentX = margin;
        }

        const selectedRating = (evaluation as any)[criterion.key];
        const justification = (evaluation as any)[`${criterion.key}Justification`] || '';

        // Draw containing box
        doc.setDrawColor(200);
        doc.rect(currentX, criteriaY, boxWidth, boxHeight);

        // Title and Description
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        const titleLines = doc.splitTextToSize(criterion.title, boxWidth - 6);
        doc.text(titleLines, currentX + 3, criteriaY + 4);
        const descY = criteriaY + 4 + (titleLines.length * 3);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.text(criterion.desc, currentX + 3, descY, { maxWidth: boxWidth - 6 });

        // Ratings buttons
        const ratingY = criteriaY + 24;
        const ratingButtonWidth = (boxWidth - 10) / 4;
        Object.keys(ratings).forEach((key, i) => {
            const buttonX = currentX + 3 + (i * (ratingButtonWidth + 1));
            doc.setFillColor(240, 240, 240);
            doc.setDrawColor(200);
            doc.rect(buttonX, ratingY, ratingButtonWidth, 5, 'FD');
            doc.setFontSize(8);
            if (key === selectedRating) {
                doc.setFillColor(...ratings[key].color);
                doc.rect(buttonX, ratingY, ratingButtonWidth, 5, 'F');
                doc.setTextColor(255, 255, 255);
            } else {
                 doc.setTextColor(0);
            }
            doc.text(key, buttonX + ratingButtonWidth / 2, ratingY + 3.5, { align: 'center' });
        });
        doc.setTextColor(0); // Reset text color

        // Justification box
        doc.setFontSize(6);
        doc.setDrawColor(200);
        doc.rect(currentX + 3, criteriaY + 31, boxWidth - 6, 14);
        doc.text('Justifique su calificación:', currentX + 4, criteriaY + 33.5);
        doc.setFontSize(7);
        const justificationLines = doc.splitTextToSize(justification, boxWidth - 8);
        doc.text(justificationLines, currentX + 4, criteriaY + 36.5);

        currentX += boxWidth + boxGap;
    });

    lastY = criteriaY + boxHeight + 2; // Update lastY based on the last row of criteria

    // === FINAL SECTION (OBSERVATIONS & GENERAL EVALUATION) ===
    doc.setFontSize(8);
    const finalBoxWidth = (pageWidth - margin * 2 - 5) / 2;
    
    // Observations
    doc.setDrawColor(200);
    doc.rect(margin, lastY, finalBoxWidth * 1.3, 25); 
    doc.setFont('helvetica', 'bold');
    doc.text('Observaciones', margin + 3, lastY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const obsLines = doc.splitTextToSize(evaluation.observations || 'Sin observaciones.', finalBoxWidth * 1.3 - 6)
    doc.text(obsLines, margin + 3, lastY + 8);
    
    // General Evaluation
    const evalX = margin + finalBoxWidth * 1.3 + 5;
    const evalWidth = pageWidth - evalX - margin;
    doc.setDrawColor(200);
    doc.rect(evalX, lastY, evalWidth, 25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Evaluación General', evalX + evalWidth / 2, lastY + 7, { align: 'center' });
    doc.setFontSize(22);
    doc.setTextColor(221, 14, 58); // primary color
    doc.text(`${evaluation.generalEvaluation}%`, evalX + evalWidth / 2, lastY + 17, { align: 'center' });
    doc.setTextColor(0);

    // Save the PDF
    const fileName = `Evaluacion_${worker.nombreCompleto.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
};


// Types for the Hiring Approval PDF function
interface HiringApproval {
  id: string;
  requesterEmail: string;
  jefeInmediatoEmail: string;
  directorRHHEmail: string;
  createdAt: number;
  bossSelection?: {
    selectedCandidateId: string;
    bossComments?: string;
    selectionDate: number;
  };
  processInfo?: {
    cargo: string;
    empresa: string;
    tipoContrato: string;
    isRetroactive?: boolean;
    effectiveHiringDate?: string;
    justificationForRetroactive?: string;
  };
}

interface CandidateInfo {
    nombres: string;
    apellidos: string;
    cedula: string;
}

interface EvaluationInfo {
    notaGeneral: number;
    formacionAcademica: number;
    conocimientosTecnicos: number;
    experiencia: number;
    competencias: number;
    status: string;
    aspiracionSalarial?: number;
}

interface Signatory {
    nombres: string;
    apellidos: string;
    cargo: string;
}

interface HiringProcessInfo {
  formacionAcademicaPct?: number;
  conocimientosTecnicosPct?: number;
  experienciaPct?: number;
  competenciasPct?: number;
}

const getInitials = (text: string = '') => {
    if (!text) return '';
    return text.split(' ').filter(Boolean).map(word => word[0]).join('').toUpperCase();
};

const addPage1Header = (doc: any, approval: HiringApproval) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    let lastY = 12;

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('APROBACIÓN DE CONTRATACIÓN', pageWidth / 2, lastY, { align: 'center' });
    lastY += 15;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Fecha de Emisión: ${format(new Date(approval.createdAt), 'dd/MM/yyyy')}`, margin, lastY);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const codeText = `Código: SUD-PLF-${new Date(approval.createdAt).getFullYear()}-${approval.id.slice(0, 4)}`;
    doc.text(codeText, pageWidth - margin, lastY, { align: 'right' });
    
    lastY += 8;
    doc.setDrawColor(150);
    doc.setLineWidth(0.2);
    doc.line(margin, lastY, pageWidth - margin, lastY);
    lastY += 2;

    return lastY;
};

const addPage2Header = (doc: any, approval: HiringApproval) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    let lastY = 12;

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('EVALUACIÓN DE PERFIL (PUESTO VS. PERSONA)', pageWidth / 2, lastY, { align: 'center' });

    lastY += 20; // Increased space
    
    doc.setDrawColor(150);
    doc.line(margin, lastY, pageWidth - margin, lastY);

    return lastY + 8;
};

const addSignatureBlock = (doc: any, x: number, y: number, signatory: Signatory, role: string, date: number) => {
    const signatureWidth = 65;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`${signatory.nombres} ${signatory.apellidos}`.toUpperCase(), x + signatureWidth / 2, y - 3, { align: 'center' });
    
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.line(x, y, x + signatureWidth, y);
    
    let detailsY = y + 4;
    doc.setFont('helvetica', 'normal');
    doc.text(role, x + signatureWidth / 2, detailsY, { align: 'center' });
    detailsY += 4;
    doc.text(format(new Date(date), 'dd/MM/yyyy, HH:mm'), x + signatureWidth / 2, detailsY, { align: 'center' });
    detailsY += 4;
    doc.text(`Método de Autenticación: Correo y Contraseña`, x + signatureWidth / 2, detailsY, { align: 'center' });
    detailsY += 4;
    doc.text(`Dirección IP: 127.0.0.1`, x + signatureWidth / 2, detailsY, { align: 'center' });
};


export const generateHiringApprovalPDF = async (
    approval: HiringApproval,
    candidate: CandidateInfo,
    evaluation: EvaluationInfo,
    evaluator: Signatory,
    boss: Signatory,
    rhDirector: Signatory,
    process?: HiringProcessInfo
) => {
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;

    // --- PAGE 1 ---
    let page1Y = addPage1Header(doc, approval);
    
    if (approval.processInfo?.isRetroactive) {
        page1Y += 4;
        const retroBoxHeight = 16;
        doc.setFillColor(255, 249, 196); // light yellow
        doc.setDrawColor(204, 153, 0); // darker yellow
        doc.setLineWidth(0.2);
        doc.rect(margin, page1Y, pageWidth - margin * 2, retroBoxHeight, 'FD');
        
        doc.setTextColor(180, 83, 9); // orange-700
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('PROCESO DE REGULARIZACIÓN (RETROACTIVO)', pageWidth / 2, page1Y + 5, { align: 'center' });
        
        doc.setTextColor(0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        const effectiveDateText = `Fecha de Ingreso Efectiva: ${formatDate(approval.processInfo.effectiveHiringDate)}`;
        const justificationText = `Justificación: ${approval.processInfo.justificationForRetroactive || 'No se proporcionó justificación.'}`;
        
        doc.text(effectiveDateText, margin + 4, page1Y + 9);
        doc.text(justificationText, margin + 4, page1Y + 13, { maxWidth: pageWidth - margin * 2 - 8 });
        
        page1Y += retroBoxHeight + 6;
    }


    const empresa = approval.processInfo?.empresa || '';
    const cargo = approval.processInfo?.cargo || '';
    const year = new Date(approval.createdAt).getFullYear().toString().slice(-2);
    const sequence = approval.id.slice(0, 4).toUpperCase();
    const codEval = `${getInitials(empresa)}-${getInitials(cargo)}-${year}-${sequence}`;
    
    const tableBody = [[
        `${candidate.apellidos} ${candidate.nombres}`,
        approval.processInfo?.cargo || 'N/A',
        'N/A', 
        'N/A', 
        approval.processInfo?.isRetroactive ? formatDate(approval.processInfo.effectiveHiringDate) : (approval.bossSelection?.selectionDate ? formatDate(approval.bossSelection.selectionDate) : 'N/A'),
        evaluation.aspiracionSalarial ? `$${evaluation.aspiracionSalarial.toFixed(2)}` : 'N/A',
        codEval,
        approval.bossSelection?.bossComments || 'APROBADO'
    ]];

    (doc as any).autoTable({
        startY: page1Y,
        head: [['NOMBRE CANDIDATO', 'PUESTO', 'C. COSTOS', 'CAMP.', 'INGRESO', 'SUELDO', 'COD EVAL', 'OBSERVACIONES']],
        body: tableBody,
        theme: 'grid',
        headStyles: {
            fillColor: [230, 230, 230],
            textColor: 20,
            fontStyle: 'bold',
            fontSize: 7,
            cellPadding: 2,
            lineWidth: 0.1,
            lineColor: [200, 200, 200]
        },
        styles: {
            fontSize: 7,
            cellPadding: 2,
            valign: 'middle',
            lineWidth: 0.1,
            lineColor: [200, 200, 200]
        },
        margin: { left: margin, right: margin },
    });
    
    const signatureBlockY = pageHeight - 60;
    const signatureLineY = signatureBlockY + 15;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('APROBACIÓN ELECTRÓNICA:', margin, signatureBlockY);

    const signatureWidth = 65;
    const signatureGap = (pageWidth - margin * 2 - signatureWidth * 3) / 2;
    const evaluatorX = margin;
    const bossX = evaluatorX + signatureWidth + signatureGap;
    const rhX = bossX + signatureWidth + signatureGap;

    addSignatureBlock(doc, evaluatorX, signatureLineY, evaluator, 'Evaluador', approval.createdAt);
    addSignatureBlock(doc, bossX, signatureLineY, boss, 'Líder de Área', approval.bossSelection?.selectionDate || Date.now());
    addSignatureBlock(doc, rhX, signatureLineY, rhDirector, 'Director de RR.HH.', Date.now());

    // --- PAGE 2 ---
    doc.addPage('a4', 'landscape');
    let page2Y = addPage2Header(doc, approval);
    
    const formacionPct = process?.formacionAcademicaPct ?? 0;
    const conocimientosPct = process?.conocimientosTecnicosPct ?? 0;
    const experienciaPct = process?.experienciaPct ?? 0;
    const competenciasPct = process?.competenciasPct ?? 0;

    const formacionResultado = evaluation.formacionAcademica * formacionPct;
    const conocimientosResultado = (evaluation.conocimientosTecnicos / 10) * conocimientosPct;
    const experienciaResultado = (evaluation.experiencia / 20) * experienciaPct;
    const competenciasResultado = ((evaluation.competencias - 1) / 4) * competenciasPct;

    const mainTableBody2 = [[
        `${candidate.apellidos} ${candidate.nombres}`,
        approval.processInfo?.cargo || 'N/A',
        `${formacionResultado.toFixed(0)}%`,
        `${conocimientosResultado.toFixed(0)}%`,
        `${experienciaResultado.toFixed(0)}%`,
        `${competenciasResultado.toFixed(0)}%`,
    ]];

    (doc as any).autoTable({
        startY: page2Y,
        head: [['NOMBRE CANDIDATO', 'PUESTO', 'FORMACIÓN ACADÉMICA', 'CONOCIMIENTOS TÉCNICOS', 'EXPERIENCIA', 'COMPETENCIAS']],
        body: mainTableBody2,
        theme: 'grid',
        headStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: 'bold', fontSize: 7, cellPadding: 2, lineWidth: 0.1, lineColor: [200, 200, 200], halign: 'center' },
        styles: { fontSize: 8, cellPadding: 2, valign: 'middle', lineWidth: 0.1, lineColor: [200, 200, 200], halign: 'center' },
        margin: { left: margin, right: margin },
    });
    page2Y = (doc as any).lastAutoTable.finalY + 10;
    
    const ponderacionHead = [
        [{ content: 'PONDERACIÓN DE EVALUACIÓN', colSpan: 5, styles: { halign: 'center' } }],
        ['COMPETENCIA', 'PONDERACIÓN', 'ESCALA', 'OBTENIDO', 'RESULTADO %']
    ];

    const ponderacionBody = [
        ['FORMACIÓN ACADÉMICA', `${formacionPct}%`, 'Cumple(1)/No Cumple(0)', evaluation.formacionAcademica, `${formacionResultado.toFixed(0)}%`],
        ['CONOCIMIENTOS TÉCNICOS', `${conocimientosPct}%`, '1 - 10', evaluation.conocimientosTecnicos, `${experienciaResultado.toFixed(0)}%`],
        ['EXPERIENCIA', `${experienciaPct}%`, '0 - 20', evaluation.experiencia, `${experienciaResultado.toFixed(0)}%`],
        ['COMPETENCIAS', `${competenciasPct}%`, '1 - 5', evaluation.competencias, `${competenciasResultado.toFixed(0)}%`],
    ];

    (doc as any).autoTable({
        startY: page2Y,
        head: ponderacionHead,
        body: ponderacionBody,
        theme: 'grid',
        tableWidth: (pageWidth - margin * 2) * 0.7,
        margin: { left: margin },
        headStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: 'bold', halign: 'center', fontSize: 8, cellPadding: 1.5, lineWidth: 0.1 },
        styles: { fontSize: 8, cellPadding: 1.5, valign: 'middle', lineWidth: 0.1, lineColor: [200, 200, 200] },
        columnStyles: { 
            0: { fontStyle: 'bold', cellWidth: 'auto' },
            1: { halign: 'center', cellWidth: 30 },
            2: { halign: 'center', cellWidth: 30 },
            3: { halign: 'center', cellWidth: 25 },
            4: { halign: 'center', cellWidth: 30, fontStyle: 'bold' },
        }
    });

    const summaryTableStartY = (doc as any).lastAutoTable.finalY + 5;
    const statusLabel = evaluation.status === 'C' ? 'CONTRATABLE' : 'NO CONTRATABLE';

    (doc as any).autoTable({
        startY: summaryTableStartY,
        head: [['EVALUACIÓN GENERAL', 'STATUS']],
        body: [[`${evaluation.notaGeneral}%`, statusLabel]],
        theme: 'grid',
        tableWidth: (pageWidth - margin * 2) * 0.7,
        margin: { left: margin },
        headStyles: {
            fillColor: [230, 230, 230],
            textColor: 20,
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 8,
            cellPadding: 1.5,
            lineWidth: 0.1
        },
        styles: {
            fontSize: 9,
            fontStyle: 'bold',
            cellPadding: 2,
            valign: 'middle',
            lineWidth: 0.1,
            lineColor: [200, 200, 200],
            halign: 'center'
        },
    });


    const signatureBlockYPage2 = pageHeight - 60;
    addSignatureBlock(doc, evaluatorX, signatureBlockYPage2, evaluator, 'Evaluador', approval.createdAt);
    addSignatureBlock(doc, bossX, signatureBlockYPage2, boss, 'Líder de Área', approval.bossSelection?.selectionDate || Date.now());
    addSignatureBlock(doc, rhX, signatureBlockYPage2, rhDirector, 'Director de RR.HH.', Date.now());


    // --- FOOTER (Loop through pages) ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
            `Página ${i} de ${pageCount}`,
            pageWidth - margin,
            pageHeight - 10,
            { align: 'right' }
        );
    }
    
    const fileName = `Aprobacion_${candidate.apellidos}_${candidate.nombres}.pdf`;
    doc.save(fileName);
};

/**
 * Genera un PDF profesional de página completa para el Acta de Relevo.
 */
export const generateHandoverPDF = async (handover: EquipmentHandover) => {
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    let currentY = 0;

    // 1. Header Logo (Full width)
    const headerHeight = 35;
    doc.addImage(LOGO_URL, 'PNG', 0, 0, pageWidth, headerHeight);
    currentY = headerHeight + 5;

    // 2. Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text('ACTA DE RELEVO DIGITAL DE PUESTO', pageWidth / 2, currentY, { align: 'center' });
    currentY += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(`Control de Auditoría #${handover.id.slice(-8).toUpperCase()}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;

    // 3. Metadata Grid
    const metadata = [
        ['UBICACIÓN / PUESTO', handover.location, 'ESTADO DEL ACTA', handover.status === 'approved' ? 'VALIDADO' : 'PENDIENTE'],
        ['FECHA Y HORA REG.', format(new Date(handover.timestamp), 'dd/MM/yyyy HH:mm', { locale: es }), 'ID AUDITORÍA', handover.id.slice(-12).toUpperCase()]
    ];

    (doc as any).autoTable({
        startY: currentY,
        body: metadata,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
            0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 35 },
            1: { cellWidth: 55 },
            2: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 35 },
            3: { cellWidth: 55 }
        },
        margin: { left: margin, right: margin }
    });
    currentY = (doc as any).lastAutoTable.finalY + 5;

    // 4. Personal Section
    const staff = [
        ['PERSONAL ENTRANTE (RECIBE)', handover.incomingGuardName, 'PERSONAL SALIENTE (ENTREGA)', handover.outgoingGuardName]
    ];
    (doc as any).autoTable({
        startY: currentY,
        body: staff,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
            0: { fontStyle: 'bold', textColor: [5, 150, 105], cellWidth: 45 }, // Emerald
            1: { fontStyle: 'bold', cellWidth: 45 },
            2: { fontStyle: 'bold', textColor: [37, 99, 235], cellWidth: 45 }, // Blue
            3: { fontStyle: 'bold', cellWidth: 45 }
        },
        margin: { left: margin, right: margin }
    });
    currentY = (doc as any).lastAutoTable.finalY + 8;

    // 5. Inventory Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('INVENTARIO DE DOTACIÓN Y ESTADO OPERATIVO', margin, currentY);
    currentY += 4;

    const tableBody = handover.items.map(item => [
        item.name,
        item.status === 'good' ? 'OPERATIVO' : 'NOVEDAD',
        item.status === 'issue' ? `${item.issueType || 'Novedad'}: ${item.notes || ''}` : 'Sin novedad reportada',
        item.photoUrl ? '' : '-' // Placeholder for photo
    ]);

    (doc as any).autoTable({
        startY: currentY,
        head: [['ACTIVO', 'ESTADO', 'DETALLE DE NOVEDAD', 'EVIDENCIA']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
        styles: { fontSize: 8, cellPadding: 4, valign: 'middle' },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 35 },
            1: { halign: 'center', cellWidth: 25 },
            2: { cellWidth: 90 },
            3: { halign: 'center', cellWidth: 30 }
        },
        margin: { left: margin, right: margin },
        didDrawCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 3) {
                const item = handover.items[data.row.index];
                if (item.photoUrl) {
                    try {
                        doc.addImage(item.photoUrl, 'JPEG', data.cell.x + 5, data.cell.y + 2, 20, 20);
                    } catch (e) {
                        console.error('Error adding image to PDF', e);
                    }
                }
            }
        }
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;

    // 6. Signatures (Balanced at bottom)
    const sigWidth = 70;
    const sigHeight = 25;
    const sigY = 250; // Force towards bottom

    // Outgoing Signature
    doc.setDrawColor(200);
    doc.line(margin, sigY, margin + sigWidth, sigY);
    doc.setFontSize(8);
    doc.text('FIRMA DE ENTREGA (SALIENTE)', margin + sigWidth / 2, sigY + 4, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(handover.outgoingGuardName, margin + sigWidth / 2, sigY + 8, { align: 'center' });
    if (handover.outgoingSignature) {
        doc.addImage(handover.outgoingSignature, 'PNG', margin + 5, sigY - 22, sigWidth - 10, 20);
    }

    // Incoming Signature
    doc.line(pageWidth - margin - sigWidth, sigY, pageWidth - margin, sigY);
    doc.setFont('helvetica', 'normal');
    doc.text('FIRMA DE RECEPCIÓN (ENTRANTE)', pageWidth - margin - sigWidth / 2, sigY + 4, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(handover.incomingGuardName, pageWidth - margin - sigWidth / 2, sigY + 8, { align: 'center' });
    if (handover.incomingSignature) {
        doc.addImage(handover.incomingSignature, 'PNG', pageWidth - margin - sigWidth + 5, sigY - 22, sigWidth - 10, 20);
    }

    // 7. Legal Footer
    const footerY = 280;
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    const legalText = 'Documento oficial emitido por la plataforma Performa para Cadenvill Security. Este registro electrónico constituye una prueba auditable del estado de los activos en el momento del relevo bajo la normativa legal vigente de firmas electrónicas.';
    doc.text(doc.splitTextToSize(legalText, pageWidth - margin * 2), pageWidth / 2, footerY, { align: 'center' });

    // Save
    doc.save(`Acta_Relevo_${handover.location.replace(/\s+/g, '_')}_${format(new Date(handover.timestamp), 'yyyyMMdd_HHmm')}.pdf`);
};
