import { type CellHookData } from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { PersonDTO, EvaluationDTO } from './contracts';
import type { EquipmentHandover, Memorandum } from './types';

const LOGO_URL = 'https://i.postimg.cc/B6HGbmCz/LOGO-CADENVILL.png';
const LOGO_SUDINCO = 'https://i.postimg.cc/dVNnyXXt/Logo_sudinc.png';

const formatDate = (dateStr: string | undefined | number) => {
    if (!dateStr) return 'N/A';
    try {
        const date = new Date(dateStr);
        if(isNaN(date.getTime())) return String(dateStr);
        return format(date, 'dd/MM/yyyy, HH:mm', { locale: es });
    } catch {
        return String(dateStr);
    }
};

const ratings: Record<string, { label: string, color: [number, number, number] }> = {
    NT: { label: "No Tiene", color: [239, 68, 68] },
    BA: { label: "Bajo", color: [250, 204, 21] },
    ED: { label: "En Desarrollo", color: [34, 197, 94] },
    TI: { label: "Tiene", color: [20, 184, 166] },
};

export const generateEvaluationPDF = async (worker: PersonDTO, evaluator: PersonDTO, evaluation: EvaluationDTO) => {
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('EVALUACIÓN DE DESEMPEÑO', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text('FORMULARIO DE RECURSOS HUMANOS', pageWidth / 2, 9, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line(margin, 20, pageWidth - margin, 20);
    let lastY = 22;

    doc.setFillColor(224, 224, 224);
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

    const fileName = `Evaluacion_${worker.nombreCompleto.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
};

export const generateHandoverPDF = async (handover: EquipmentHandover) => {
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let currentY = 0;

    const headerHeight = 35;
    doc.addImage(LOGO_URL, 'PNG', 0, 0, pageWidth, headerHeight);
    currentY = headerHeight + 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('ACTA DE RELEVO DIGITAL DE PUESTO', pageWidth / 2, currentY, { align: 'center' });
    currentY += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Documento de Auditoría Institucional #${handover.id.slice(-8).toUpperCase()}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;

    const metadata = [
        ['UBICACIÓN / PUESTO', handover.location, 'ESTADO DEL ACTA', handover.status === 'approved' ? 'VALIDADO' : 'PENDIENTE'],
        ['FECHA Y HORA REG.', format(new Date(handover.timestamp), 'dd/MM/yyyy HH:mm', { locale: es }), 'ID AUDITORÍA', handover.id.slice(-12).toUpperCase()]
    ];

    (doc as any).autoTable({
        startY: currentY,
        body: metadata,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.5 },
        columnStyles: {
            0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 35 },
            1: { cellWidth: 55 },
            2: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 35 },
            3: { cellWidth: 55 }
        },
        margin: { left: margin, right: margin }
    });
    currentY = (doc as any).lastAutoTable.finalY + 5;

    const staff = [
        ['PERSONAL ENTRANTE (RECIBE)', handover.incomingGuardName, 'PERSONAL SALIENTE (ENTREGA)', handover.outgoingGuardName]
    ];
    (doc as any).autoTable({
        startY: currentY,
        body: staff,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3.5 },
        columnStyles: {
            0: { fontStyle: 'bold', textColor: [5, 150, 105], cellWidth: 45 },
            1: { fontStyle: 'bold', cellWidth: 45 },
            2: { fontStyle: 'bold', textColor: [37, 99, 235], cellWidth: 45 },
            3: { fontStyle: 'bold', cellWidth: 45 }
        },
        margin: { left: margin, right: margin }
    });
    currentY = (doc as any).lastAutoTable.finalY + 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('INVENTARIO DE DOTACIÓN Y ESTADO OPERATIVO', margin, currentY);
    currentY += 4;

    const tableBody = handover.items.map(item => [
        item.name,
        item.status === 'good' ? 'OPERATIVO' : 'NOVEDAD',
        item.status === 'issue' ? `${item.issueType || 'Novedad'}: ${item.notes || ''}` : 'Sin novedad reportada',
        item.photoUrl ? '' : '-'
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
    currentY = (doc as any).lastAutoTable.finalY + 10;

    const sigWidth = 70;
    const sigY = pageHeight - 45;

    doc.setDrawColor(200);
    doc.line(margin, sigY, margin + sigWidth, sigY);
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('FIRMA DE RECEPCIÓN (ENTRANTE)', margin + sigWidth / 2, sigY + 4, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(handover.incomingGuardName, margin + sigWidth / 2, sigY + 8, { align: 'center' });
    if (handover.incomingSignature) {
        doc.addImage(handover.incomingSignature, 'PNG', margin + 5, sigY - 22, sigWidth - 10, 20);
    }

    doc.line(pageWidth - margin - sigWidth, sigY, pageWidth - margin, sigY);
    doc.setFont('helvetica', 'normal');
    doc.text('FIRMA DE ENTREGA (SALIENTE)', pageWidth - margin - sigWidth / 2, sigY + 4, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(handover.outgoingGuardName, pageWidth - margin - sigWidth / 2, sigY + 8, { align: 'center' });
    if (handover.outgoingSignature) {
        doc.addImage(handover.outgoingSignature, 'PNG', pageWidth - margin - sigWidth + 5, sigY - 22, sigWidth - 10, 20);
    }

    const footerY = pageHeight - 15;
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    const legalText = 'Este documento digital es una prueba auditable del relevo operativo de Cadenvill Security. La firma electrónica vincula legalmente al personal con el estado reportado de los activos.';
    doc.text(doc.splitTextToSize(legalText, pageWidth - margin * 2), pageWidth / 2, footerY, { align: 'center' });

    doc.save(`Acta_Relevo_${handover.location.replace(/\s+/g, '_')}_${format(new Date(handover.timestamp), 'yyyyMMdd_HHmm')}.pdf`);
};

export const generateMemorandumPDF = async (memo: Memorandum) => {
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let currentY = 0;

    // Header Institucional estilo Handover
    const headerHeight = 35;
    doc.addImage(LOGO_URL, 'PNG', 0, 0, pageWidth, headerHeight);
    currentY = headerHeight + 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('MEMORANDO INSTITUCIONAL', pageWidth / 2, currentY, { align: 'center' });
    currentY += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Documento de Auditoría Institucional #${memo.id.slice(-8).toUpperCase()}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;

    const metadata = [
        ['CÓDIGO DOCUMENTO', memo.code, 'FECHA DE EMISIÓN', format(new Date(memo.createdAt), 'dd/MM/yyyy', { locale: es })],
        ['PARA (COLABORADOR)', memo.targetUserName.toUpperCase(), 'CARGO / FUNCIÓN', memo.targetUserCargo.toUpperCase()]
    ];

    (doc as any).autoTable({
        startY: currentY,
        body: metadata,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.5 },
        columnStyles: {
            0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 35 },
            1: { cellWidth: 55 },
            2: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 35 },
            3: { cellWidth: 55 }
        },
        margin: { left: margin, right: margin }
    });
    currentY = (doc as any).lastAutoTable.finalY + 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`ASUNTO: ${memo.type.toUpperCase()} - ${memo.reason.toUpperCase()}`, margin, currentY);
    currentY += 8;

    // Contenido del Memorando
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(0);
    const splitContent = doc.splitTextToSize(memo.content, pageWidth - margin * 2);
    doc.text(splitContent, margin, currentY, { align: 'justify', lineHeightFactor: 1.5 });
    
    currentY += (splitContent.length * 6) + 15;

    // Si el contenido es muy largo, saltar página para firmas
    if (currentY > pageHeight - 60) {
        doc.addPage();
        currentY = 20;
    }

    const sigWidth = 70;
    const sigY = pageHeight - 45;

    // Firma Emisor
    doc.setDrawColor(200);
    doc.line(margin, sigY, margin + sigWidth, sigY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(memo.issuerName.toUpperCase(), margin + sigWidth / 2, sigY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(memo.issuerCargo.toUpperCase(), margin + sigWidth / 2, sigY + 8, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text('FIRMA DEL EMISOR', margin + sigWidth / 2, sigY + 12, { align: 'center' });
    if (memo.issuerSignature) {
        doc.addImage(memo.issuerSignature, 'PNG', margin + 5, sigY - 25, sigWidth - 10, 20);
    }

    // Firma Colaborador (si aplica)
    if (memo.type === "Memorando de Llamado de Atención") {
        doc.line(pageWidth - margin - sigWidth, sigY, pageWidth - margin, sigY);
        doc.setFont('helvetica', 'bold');
        doc.text(memo.targetUserName.toUpperCase(), pageWidth - margin - sigWidth / 2, sigY + 4, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.text(memo.targetUserCargo.toUpperCase(), pageWidth - margin - sigWidth / 2, sigY + 8, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.text('FIRMA DEL COLABORADOR', pageWidth - margin - sigWidth / 2, sigY + 12, { align: 'center' });
        
        if (memo.signature) {
            doc.addImage(memo.signature, 'PNG', pageWidth - margin - sigWidth + 5, sigY - 25, sigWidth - 10, 20);
        } else if (memo.status === 'rejected') {
            doc.setTextColor(220, 38, 38);
            doc.setFontSize(14);
            doc.text('RECHAZADO', pageWidth - margin - sigWidth / 2, sigY - 10, { align: 'center' });
            doc.setTextColor(0);
        }
    }

    const footerY = pageHeight - 15;
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    const legalText = 'Este documento constituye una notificación oficial vinculante. La firma electrónica certifica la recepción y conocimiento de los términos aquí expuestos.';
    doc.text(doc.splitTextToSize(legalText, pageWidth - margin * 2), pageWidth / 2, footerY, { align: 'center' });

    doc.save(`Memorando_${memo.code.replace(/\//g, '_')}.pdf`);
};