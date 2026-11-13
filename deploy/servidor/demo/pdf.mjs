// Convierte docs/guia-de-demostracion.md en un PDF para imprimir o compartir:
// portada, las capturas incrustadas y número de página. Lo deja en
// output/pdf/guia-de-demostracion.pdf (montado en /salida). No llama a ningún
// servicio: sólo lee la guía y sus imágenes.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { marked } from 'marked';
import { navegador } from './comun.mjs';

const GUIA = '/docs/guia-de-demostracion.md';
const SALIDA = '/salida/guia-de-demostracion.pdf';

const texto = readFileSync(GUIA, 'utf8');
const titulo = texto.match(/^# (.+)$/m)?.[1] || 'Guía de demostración';
const cuerpo = texto.replace(/^# .+\n/m, '');

// Las imágenes van dentro del PDF; los enlaces a otros documentos del
// repositorio no sirven en papel y quedan como texto.
const renderer = new marked.Renderer();
renderer.image = ({ href, text }) => {
  const ruta = join(dirname(GUIA), href);
  const datos = readFileSync(ruta).toString('base64');
  return `<figure><img src="data:image/png;base64,${datos}" alt="${text}"><figcaption>${text}</figcaption></figure>`;
};
renderer.link = function ({ href, tokens }) {
  const contenido = this.parser.parseInline(tokens);
  return /^https?:/.test(href) ? `<a href="${href}">${contenido}</a>` : `<span class="enlace">${contenido}</span>`;
};
const html = marked.parse(cuerpo, { renderer, gfm: true });

const fecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'America/Mexico_City' }).format(new Date());
const documento = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${titulo}</title>
<style>
  @page { size: Letter; margin: 18mm 16mm 20mm; }
  :root { --tinta: #13233f; --tenue: #55627a; --azul: #1f56c7; --linea: #d9e1ef; --fondo: #f3f6fc; }
  * { box-sizing: border-box; }
  body { font-family: Inter, "Noto Sans", "DejaVu Sans", system-ui, sans-serif; color: var(--tinta); font-size: 10.5pt; line-height: 1.5; margin: 0; }
  .portada { height: 240mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always;
    background: linear-gradient(160deg, #2b63d9, #173f9c); color: white; padding: 0 18mm; border-radius: 6mm; }
  .portada .marca { font-size: 16pt; letter-spacing: .5px; opacity: .9; }
  .portada h1 { font-size: 34pt; margin: 6mm 0 4mm; font-weight: 600; line-height: 1.15; }
  .portada p { font-size: 12pt; margin: 0 0 2mm; opacity: .92; max-width: 140mm; }
  .portada .pie { margin-top: 18mm; font-size: 10pt; opacity: .8; }
  h2 { font-size: 16pt; color: var(--azul); margin: 9mm 0 3mm; padding-bottom: 1.5mm; border-bottom: 1.5px solid var(--linea); page-break-after: avoid; }
  h3 { font-size: 12.5pt; margin: 6mm 0 2mm; page-break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  a { color: var(--azul); text-decoration: none; }
  .enlace { color: var(--tinta); font-weight: 500; }
  code { font-family: "DejaVu Sans Mono", "Liberation Mono", monospace; font-size: 9pt; background: var(--fondo); padding: .3mm 1.2mm; border-radius: 1mm; }
  pre { background: var(--fondo); border: 1px solid var(--linea); border-radius: 2mm; padding: 3mm 4mm; page-break-inside: avoid; white-space: pre-wrap; }
  pre code { background: none; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin: 3mm 0 4mm; font-size: 9.5pt; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th { text-align: left; background: var(--fondo); color: var(--tenue); font-weight: 600; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .3px; }
  th, td { border-bottom: 1px solid var(--linea); padding: 1.8mm 2.2mm; vertical-align: top; }
  blockquote { margin: 4mm 0; padding: 3mm 4mm; background: #eef4ff; border-left: 3px solid var(--azul); border-radius: 1.5mm; }
  blockquote p { margin: 0; }
  figure { margin: 2mm 0 4mm; page-break-inside: avoid; text-align: center; }
  figure img { max-width: 100%; max-height: 96mm; border: 1px solid var(--linea); border-radius: 2mm; }
  figcaption { font-size: 8.5pt; color: var(--tenue); margin-top: 1.5mm; }
  ul.contains-task-list, li.task-list-item { list-style: none; }
  li.task-list-item input { margin-right: 2mm; }
  strong { font-weight: 600; }
</style></head>
<body>
  <section class="portada">
    <div class="marca">≈ Zenit</div>
    <h1>${titulo}</h1>
    <p>Recorrido completo del portal y la app Android en el ambiente publicado, con una empresa ficticia que se siembra y se reinicia con un solo comando.</p>
    <p class="pie">zenit.fastsolution.com.mx · generado el ${fecha}</p>
  </section>
  ${html}
</body></html>`;

const nav = await navegador();
const pagina = await nav.newPage();
await pagina.setContent(documento, { waitUntil: 'load' });
await pagina.pdf({
  path: SALIDA,
  format: 'Letter',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="width:100%;font-size:8px;color:#55627a;padding:0 16mm;display:flex;justify-content:space-between;font-family:sans-serif">
    <span>Zenit · ${titulo}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' },
});
await nav.close();
console.log(`PDF listo: ${SALIDA.replace('/salida', 'output/pdf')}`);
process.exit(0);
