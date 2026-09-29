/**
 * Documento controlado del SGC al que pertenece el tratamiento de producto no
 * conforme en KANRI. Una sola fuente para la tarjeta del procedimiento, su
 * versión impresa y el registro impreso de cada NCR (deben citar lo mismo que
 * el PDF del procedimiento).
 *
 * El documento (PR-CAL-001 "Proceso de Control de Calidad") y su sección 8
 * ("Tratamiento de Producto No Conforme y Acción Correctiva", TPNC) tienen
 * nombres distintos a propósito: no son el mismo documento.
 */
export const QMS_DOC = {
  code: 'PR-CAL-001',
  title: 'Proceso de Control de Calidad',
  revision: '2',
  revisionDate: '29 sep 2026',
  createdDate: '12 ene 2026',
  section: '8',
  sectionTitle: 'Tratamiento de Producto No Conforme y Acción Correctiva',
  sectionShort: 'TPNC',
} as const;

/** "PR-CAL-001 §8 · Tratamiento de Producto No Conforme y Acción Correctiva" */
export const QMS_SECTION_LABEL = `${QMS_DOC.code} §${QMS_DOC.section} · ${QMS_DOC.sectionTitle}`;

/** "PR-CAL-001 · Rev. 2" */
export const QMS_DOC_REV = `${QMS_DOC.code} · Rev. ${QMS_DOC.revision}`;
