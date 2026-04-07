#!/usr/bin/env python3
# backend/scripts/generar_reporte_pdf.py
# ============================================================
# Lee JSON de alumnos desde stdin, genera el PDF según el
# formato del documento Word de referencia y lo escribe a stdout.
#
# Formato requerido (del Word):
#   - Encabezado: INSTITUTO POLITÉCNICO NACIONAL (16pt bold, centrado)
#   - CECyT 9 "JUAN DE DIOS BÁTIZ" (14pt, centrado)
#   - SISTEMA DE CONTROL DE ACCESO - QR PASS (12pt, centrado)
#   - REPORTE DE GESTIÓN DE ALUMNOS (12pt, subrayado, centrado)
#   - Línea separadora
#   - Fecha y hora de emisión en cursiva
#   - Tabla: Boleta | Nombre completo | Grupo | Turno | Situación | Puertas
#   - Total de alumnos al final
#   - Márgenes Word: top/bot 2.5cm, left/right 3.0cm
#   - Papel carta (8.5" x 11")
# ============================================================

import sys
import json
import io
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib.units     import cm
from reportlab.lib           import colors
from reportlab.platypus      import (
    SimpleDocTemplate, Paragraph, Spacer,
    Table, TableStyle, HRFlowable,
)
from reportlab.lib.styles    import ParagraphStyle
from reportlab.lib.enums     import TA_CENTER, TA_LEFT

# ── Constantes de diseño ──────────────────────────────────────
MARGEN_LR   = 3.0 * cm
MARGEN_TB   = 2.5 * cm
COLOR_IPN   = colors.HexColor('#5c1f33')   # guinda institucional
COLOR_FILA  = colors.HexColor('#fdf8f9')   # rosa muy suave para filas alternas
COLOR_BORDE = colors.HexColor('#cccccc')

# ── Estilos de párrafo ────────────────────────────────────────
def crear_estilos():
    return {
        'ipn': ParagraphStyle(
            'ipn',
            fontSize=16, fontName='Helvetica-Bold',
            alignment=TA_CENTER, spaceAfter=3,
        ),
        'cecyt': ParagraphStyle(
            'cecyt',
            fontSize=14, fontName='Helvetica',
            alignment=TA_CENTER, spaceAfter=3,
        ),
        'sistema': ParagraphStyle(
            'sistema',
            fontSize=12, fontName='Helvetica',
            alignment=TA_CENTER, spaceAfter=3,
        ),
        'titulo_reporte': ParagraphStyle(
            'titulo_reporte',
            fontSize=12, fontName='Helvetica',
            alignment=TA_CENTER, spaceAfter=6,
        ),
        'fecha': ParagraphStyle(
            'fecha',
            fontSize=11, fontName='Helvetica',
            alignment=TA_LEFT, spaceAfter=8,
        ),
        'total': ParagraphStyle(
            'total',
            fontSize=11, fontName='Helvetica',
            alignment=TA_LEFT, spaceBefore=10,
        ),
        'filtros': ParagraphStyle(
            'filtros',
            fontSize=9, fontName='Helvetica',
            alignment=TA_LEFT, spaceAfter=6,
            textColor=colors.HexColor('#666666'),
        ),
    }

# ── Mes en español ────────────────────────────────────────────
MESES = [
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre',
]

def fecha_espanol(dt):
    return (
        f"{dt.day} de {MESES[dt.month - 1]} de {dt.year}, "
        f"{dt.strftime('%H:%M')} hrs"
    )

# ── Descripción legible de los filtros activos ────────────────
def describir_filtros(filtros):
    partes = []
    if filtros.get('q'):
        partes.append(f'Búsqueda: "{filtros["q"]}"')
    if filtros.get('turno'):
        partes.append(f'Turno: {filtros["turno"]}')
    if filtros.get('estado'):
        partes.append(f'Situación: {filtros["estado"]}')
    if filtros.get('puertas') == 'true':
        partes.append('Puertas: Sí')
    elif filtros.get('puertas') == 'false':
        partes.append('Puertas: No')
    return ' | '.join(partes) if partes else 'Sin filtros aplicados (todos los alumnos)'

# ── Generador principal ───────────────────────────────────────
def generar_pdf(alumnos, filtros):
    buf = io.BytesIO()

    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=MARGEN_LR, rightMargin=MARGEN_LR,
        topMargin=MARGEN_TB,  bottomMargin=MARGEN_TB,
        title='Reporte de Gestión de Alumnos - QR Pass',
        author='CECyT 9 - IPN',
    )

    estilos = crear_estilos()
    story   = []

    # ── Encabezado institucional ──────────────────────────────
    story.append(Paragraph('INSTITUTO POLITÉCNICO NACIONAL', estilos['ipn']))
    story.append(Paragraph('CECyT 9 "JUAN DE DIOS BÁTIZ"',  estilos['cecyt']))
    story.append(Paragraph('SISTEMA DE CONTROL DE ACCESO - QR PASS', estilos['sistema']))

    # Título subrayado (<u> funciona en ReportLab Paragraph)
    story.append(Paragraph('<u>REPORTE DE GESTIÓN DE ALUMNOS</u>', estilos['titulo_reporte']))

    # Línea separadora (igual al documento Word)
    story.append(HRFlowable(
        width='100%', thickness=1,
        color=COLOR_IPN, spaceAfter=8,
    ))

    # ── Fecha de emisión en cursiva ───────────────────────────
    ahora     = datetime.now()
    fecha_str = fecha_espanol(ahora)
    story.append(Paragraph(f'<i>Emitido el: {fecha_str}</i>', estilos['fecha']))

    # Filtros aplicados (información contextual)
    story.append(Paragraph(describir_filtros(filtros), estilos['filtros']))

    # ── Tabla de alumnos ──────────────────────────────────────
    ancho = letter[0] - MARGEN_LR * 2

    # Proporciones de columna (suman 1.0)
    col_widths = [
        ancho * 0.14,  # Boleta
        ancho * 0.33,  # Nombre
        ancho * 0.10,  # Grupo
        ancho * 0.13,  # Turno
        ancho * 0.16,  # Situación académica
        ancho * 0.14,  # Puertas abiertas
    ]

    # Cabecera
    cabecera = [['Boleta', 'Nombre completo', 'Grupo', 'Turno', 'Situación', 'Puertas']]

    # Filas de datos
    filas_datos = []
    for a in alumnos:
        filas_datos.append([
            str(a.get('boleta', '')),
            str(a.get('nombre_completo', '')),
            str(a.get('grupo', '—')),
            str(a.get('turno', '—')),
            str(a.get('estado_academico', '—')),
            'Sí' if a.get('puertas_abiertas') else 'No',
        ])

    # Si no hay alumnos, poner una fila informativa
    if not filas_datos:
        filas_datos = [['—', 'No se encontraron alumnos con estos filtros', '—', '—', '—', '—']]

    tabla_data = cabecera + filas_datos

    tabla = Table(tabla_data, colWidths=col_widths, repeatRows=1)
    tabla.setStyle(TableStyle([
        # ── Cabecera ──────────────────────────────────────────
        ('BACKGROUND',      (0, 0), (-1, 0),  COLOR_IPN),
        ('TEXTCOLOR',       (0, 0), (-1, 0),  colors.white),
        ('FONTNAME',        (0, 0), (-1, 0),  'Helvetica-Bold'),
        ('FONTSIZE',        (0, 0), (-1, 0),  10),
        ('ALIGN',           (0, 0), (-1, 0),  'CENTER'),

        # ── Filas de datos ────────────────────────────────────
        ('FONTNAME',        (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE',        (0, 1), (-1, -1), 10),
        ('ALIGN',           (0, 1), (-1, -1), 'LEFT'),
        # Boleta: centrada
        ('ALIGN',           (0, 1), (0, -1),  'CENTER'),
        # Puertas: centrada
        ('ALIGN',           (5, 1), (5, -1),  'CENTER'),

        # Filas alternas
        ('ROWBACKGROUNDS',  (0, 1), (-1, -1), [colors.white, COLOR_FILA]),

        # ── Bordes ────────────────────────────────────────────
        ('GRID',            (0, 0), (-1, -1), 0.5, COLOR_BORDE),
        ('BOX',             (0, 0), (-1, -1), 1.0, COLOR_IPN),
        # Borde inferior de cabecera más grueso
        ('LINEBELOW',       (0, 0), (-1, 0),  1.5, COLOR_IPN),

        # ── Padding ───────────────────────────────────────────
        ('TOPPADDING',      (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING',   (0, 0), (-1, -1), 5),
        ('LEFTPADDING',     (0, 0), (-1, -1), 6),
        ('RIGHTPADDING',    (0, 0), (-1, -1), 6),

        # ── Alineación vertical ───────────────────────────────
        ('VALIGN',          (0, 0), (-1, -1), 'MIDDLE'),
    ]))

    story.append(tabla)

    # ── Total ─────────────────────────────────────────────────
    n = len(alumnos)
    story.append(Paragraph(
        f'Total de alumnos en el reporte: <b>{n}</b>',
        estilos['total'],
    ))

    # ── Construir ─────────────────────────────────────────────
    doc.build(story)
    buf.seek(0)
    return buf.read()


# ── Punto de entrada ──────────────────────────────────────────
if __name__ == '__main__':
    try:
        raw  = sys.stdin.buffer.read()
        data = json.loads(raw.decode('utf-8'))

        alumnos = data.get('alumnos', [])
        filtros = data.get('filtros', {})

        pdf_bytes = generar_pdf(alumnos, filtros)

        # Escribir bytes del PDF a stdout
        sys.stdout.buffer.write(pdf_bytes)
        sys.stdout.buffer.flush()

    except Exception as e:
        # Escribir error a stderr (el controlador Node.js lo captura)
        sys.stderr.write(f'ERROR en generar_reporte_pdf.py: {e}\n')
        import traceback
        sys.stderr.write(traceback.format_exc())
        sys.exit(1)