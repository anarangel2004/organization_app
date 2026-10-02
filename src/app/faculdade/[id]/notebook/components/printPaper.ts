// Exportar PDF do caderno.
//
// Ao imprimir a folha tal como está, o browser nunca corta uma linha de texto
// a meio no fim da página A4: empurra-a (e parágrafos inteiros) para a página
// seguinte. O desenho da caneta é uma imagem contínua e é cortado exatamente
// no limite, por isso a cada página o texto descia em relação ao desenho.
//
// Aqui cada página do PDF é uma "janela" da folha: uma cópia da folha inteira,
// deslocada para cima, dentro de uma caixa da altura de uma página A4. Texto e
// desenho são cortados no mesmo sítio — sempre entre duas linhas do pautado
// (múltiplos de 28 px), por isso nenhuma linha de texto fica partida.

const LINE = 28; // altura de uma linha do pautado (px da folha)
const MM = 96 / 25.4; // px por mm
// Área útil do A4 com as margens do @page em globals.css (15 mm × 12 mm).
const PRINT_W = (210 - 2 * 12) * MM;
const PRINT_H = (297 - 2 * 15) * MM;

export function printPaper(paper: HTMLElement, inkImage: string | null) {
  document.getElementById('nb-print')?.remove();

  const width = paper.offsetWidth; // largura da folha sem o zoom do ecrã
  const total = paper.scrollHeight;
  if (!width || !total) {
    window.print();
    return;
  }
  const zoom = Math.min(1, PRINT_W / width);
  // Altura de cada página em px da folha, arredondada às linhas (com folga de uma linha).
  const pageH = Math.max(LINE * 4, Math.floor(PRINT_H / zoom / LINE) * LINE - LINE);
  const pages = Math.max(1, Math.ceil(total / pageH));

  const cs = window.getComputedStyle(paper);
  const root = document.createElement('div');
  root.id = 'nb-print';
  // As variáveis de cor e a letra vêm do caderno; fora dele perdiam-se.
  for (const name of Array.from(cs)) {
    if (name.startsWith('--')) root.style.setProperty(name, cs.getPropertyValue(name));
  }
  root.style.fontFamily = cs.fontFamily;
  root.style.color = cs.color;

  // Cópia "congelada" da folha, igual ao ecrã.
  const base = paper.cloneNode(true) as HTMLElement;
  const fix = (el: HTMLElement, prop: string, value: string) => el.style.setProperty(prop, value, 'important');
  fix(base, 'position', 'absolute');
  fix(base, 'left', '0');
  fix(base, 'margin', '0');
  fix(base, 'width', `${width}px`);
  fix(base, 'max-width', 'none');
  fix(base, 'min-height', cs.minHeight);
  fix(base, 'padding', cs.padding);
  fix(base, 'transform', 'none');
  fix(base, 'zoom', '1');
  fix(base, 'visibility', 'visible');
  fix(base, 'box-shadow', 'none');
  fix(base, 'background-image', 'none');

  // Desenho: o canvas principal passa a imagem em alta resolução; a camada do traço em curso sai.
  base.querySelectorAll('canvas').forEach((cv) => {
    if (cv.getAttribute('aria-hidden') === 'true' || !inkImage) {
      cv.remove();
      return;
    }
    const img = document.createElement('img');
    img.src = inkImage;
    img.alt = '';
    img.className = cv.className;
    img.setAttribute('style', cv.getAttribute('style') || '');
    cv.replaceWith(img);
  });

  // O que não se imprime fica invisível mas a ocupar o mesmo espaço (senão o texto subia).
  const origHidden = paper.querySelectorAll<HTMLElement>('.no-print, header, nav, aside');
  const cloneHidden = base.querySelectorAll<HTMLElement>('.no-print, header, nav, aside');
  cloneHidden.forEach((el, i) => {
    const orig = origHidden[i];
    if (orig) fix(el, 'display', window.getComputedStyle(orig).display);
    fix(el, 'visibility', 'hidden');
    el.classList.remove('no-print');
  });

  // As alturas dos blocos ficam como no ecrã (o CSS global de impressão põe height:auto nos div).
  const origDivs = paper.querySelectorAll<HTMLElement>('div');
  base.querySelectorAll<HTMLElement>('div').forEach((el, i) => {
    const orig = origDivs[i];
    if (!orig) return;
    const ocs = window.getComputedStyle(orig);
    if (ocs.minHeight && ocs.minHeight !== '0px' && ocs.minHeight !== 'auto') fix(el, 'min-height', ocs.minHeight);
  });

  for (let i = 0; i < pages; i++) {
    const page = document.createElement('section');
    const h = Math.min(pageH, total - i * pageH);
    page.style.cssText = `position:relative;overflow:hidden;width:${width}px;height:${h}px;zoom:${zoom};`;
    if (i < pages - 1) {
      page.style.breakAfter = 'page';
      page.style.setProperty('page-break-after', 'always');
    }
    const copy = i === 0 ? base : (base.cloneNode(true) as HTMLElement);
    fix(copy, 'top', `${-i * pageH}px`);
    page.appendChild(copy);
    root.appendChild(page);
  }

  document.body.appendChild(root);
  document.body.classList.add('nb-printing');
  const done = () => {
    window.removeEventListener('afterprint', done);
    document.body.classList.remove('nb-printing');
    root.remove();
  };
  window.addEventListener('afterprint', done);

  // Espera que a imagem do desenho esteja pronta antes de abrir a impressão.
  const imgs = Array.from(root.querySelectorAll('img'));
  Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => undefined) : Promise.resolve()))).then(() => window.print());
}
