// =====================================================================
//  Caça aos Ovos — código comum a todas as páginas do site principal:
//  entrada (index.html), pistas, chave, ovos, ranking e conta.
//  Cada página diz quem ela é em <body data-pagina="...">.
//  A chave pública (anon / publishable) PODE ficar no site: quem
//  protege os dados são as regras de segurança do banco.
// =====================================================================
const SUPABASE_URL = "https://xjgpxdojkpuzcspypeby.supabase.co";
const SUPABASE_KEY = "sb_publishable_SVtXrEDZI6T6-kFRFFFq8A__ez2hWaq";

// Brilho usado quando você escreve só [[palavra]] nos textos.
// Opções: "aura", "reflexo" ou "estrelas".
const BRILHO_PADRAO = "aura";

const app = document.getElementById("app");

// Ícones desenhados no mesmo traço do selo (substituem os emojis da interface)
const ICONES = {
  chave:   `<circle cx="8" cy="15.5" r="4.2"/><path d="M11 12.4 20 3.4M16.6 6.8l2.4 2.4M14.3 9.1l1.9 1.9"/>`,
  ovo:     `<path d="M12 3C8.2 3 5.5 9 5.5 13.5 5.5 17.6 8.4 21 12 21s6.5-3.4 6.5-7.5C18.5 9 15.8 3 12 3z"/>`,
  lupa:    `<circle cx="10.5" cy="10.5" r="6.2"/><path d="M15.2 15.2 20.5 20.5M10.5 7.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>`,
  trofeu:  `<path d="M7 4h10v4.5a5 5 0 0 1-10 0V4zM7 6H4.6a2.6 2.6 0 0 0 3 4M17 6h2.4a2.6 2.6 0 0 1-3 4M12 13.5V17M9.2 17h5.6l.8 3H8.4z"/>`,
  engrenagem: `<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.6"/><path d="M12 2.6v2.8M12 18.6v2.8M2.6 12h2.8M18.6 12h2.8M5.4 5.4l2 2M16.6 16.6l2 2M5.4 18.6l2-2M16.6 7.4l2-2"/>`,
  cadeado: `<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2.4"/>`,
  porta:   `<path d="M14 4H6v16h8M10 12h10M17 9l3 3-3 3"/>`,
  lixeira: `<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>`,
  brilho:  `<path d="M11 3l1.7 5.3L18 10l-5.3 1.7L11 17l-1.7-5.3L4 10l5.3-1.7zM18.5 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>`,
  escudo:  `<path d="M12 2.8 4.5 5.6v5.6c0 4.6 3.1 8.4 7.5 10 4.4-1.6 7.5-5.4 7.5-10V5.6z"/><path d="M12 8.2l1.2 2.5 2.7.3-2 1.9.5 2.7L12 14.3l-2.4 1.3.5-2.7-2-1.9 2.7-.3z"/>`
};
const ic = (nome, extra = "") => `<svg class="ic ${extra}" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome]}</svg>`;
// Medalha desenhada para 1º, 2º e 3º; do 4º em diante, só o número
const medalhaDe = p => p >= 1 && p <= 3
  ? `<svg class="medalha m${p}" viewBox="0 0 32 36" role="img" aria-label="${p}º lugar"><path class="fita" d="M9 1h6l3.4 12h-6zM23 1h-6l-3.4 12h6z"/><circle class="disco" cx="16" cy="23" r="10"/><text x="16" y="26.4" text-anchor="middle">${p}</text></svg>`
  : `${p}º`;

// Página atual: "entrada", "pistas", "chave", "ovos", "ranking" ou "conta"
const PAGINA = document.body.dataset.pagina;

let sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
let sessao = null;
let ovos = [];             // vem do banco: [{ numero, nome, descricao, imagem, categorias, encontrado_em }]
let coresCat = new Map();  // categoria (minúsculas) → { cor, icone }
let pistas = [];           // vem do banco: [{ id, titulo, descricao, ..., vista }]
let souDebugger = false;   // quem confere é o Supabase (sou_debugger); aqui só decide se mostra o ícone

const achou = o => !!o.encontrado_em;
const num = o => "#" + String(o.numero).padStart(2, "0");
const nomeUsuario = () => sessao?.user?.user_metadata?.nome || (sessao?.user?.email || "").split("@")[0];
const dataHora = d => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

// ---- Categorias e filtros ----
const norm = s => String(s ?? "").trim().toLowerCase();
const rotulo = s => { const t = String(s ?? "").trim(); return t.charAt(0).toUpperCase() + t.slice(1); };
const porNome = (a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR");

// Lista sem repetidos (ignora maiúsculas/minúsculas e espaços)
function opcoes(valores, ordenar) {
  const mapa = new Map();
  valores.forEach(v => { const k = norm(v); if (k && !mapa.has(k)) mapa.set(k, rotulo(v)); });
  return [...mapa].map(([chave, r]) => ({ chave, rotulo: r })).sort(ordenar);
}

const ICONE_FUNIL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h18l-7 8v6l-4 2v-8z"/></svg>`;
const ICONE_LIMPAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h13l-5.5 6.3V17l-3 1.5v-8.2z"/><path d="M16 14l5 5M21 14l-5 5"/></svg>`;

function painel(titulo, tipo, lista, marcados, vazio) {
  return `
    <div class="slicer">
      <div class="slicer-head">
        <span>${titulo}</span>
        <button class="slicer-clear" data-limpar="${tipo}" title="Limpar filtro" aria-label="Limpar filtro de ${titulo}" ${marcados.size ? "" : "disabled"}>${ICONE_LIMPAR}</button>
      </div>
      ${lista.length
        ? `<div class="slicer-items">${lista.map(op =>
            `<button class="slicer-item" data-tipo="${tipo}" data-valor="${esc(op.chave)}" aria-pressed="${marcados.has(op.chave)}">${tipo === "c" ? pontoCor(op.chave) : tipo === "d" ? `<span class="cor-dot dif-${esc(op.chave)}"></span>` : ""}${esc(op.rotulo)}</button>`).join("")}</div>`
        : `<p class="slicer-vazio">${vazio}</p>`}
    </div>`;
}

// ---- Cores das categorias ----
// Só aceita cores no formato #abc ou #aabbcc (evita texto estranho no estilo)
const corValida = c => { const t = String(c ?? "").trim(); return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t) ? t : null; };
// Texto escuro em cores claras, texto branco em cores escuras
function corDoTexto(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map(x => x + x).join("");
  const n = parseInt(h, 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? "#1b1712" : "#ffffff";
}
const BRILHOS = ["aura", "reflexo", "estrelas"];
function etiqueta(c) {
  const info = coresCat.get(norm(c)) || {};
  const cor = corValida(info.cor);
  const estilo = cor ? ` style="background:${cor};color:${corDoTexto(cor)};--cor:${cor}"` : "";
  const brilho = BRILHOS.includes(info.brilho) ? ` tag-${info.brilho}` : "";
  return `<span class="tag${brilho}"${estilo}>${info.icone ? esc(info.icone) + " " : ""}${esc(rotulo(c))}</span>`;
}

// Formatação dentro dos textos: [[estilos:texto]]
//   [[palavra]]                    → brilho padrão (BRILHO_PADRAO)
//   brilhos: aura, reflexo, estrelas
//   forma:   negrito, italico, sublinhado, riscado, grande, pequeno, segredo,
//            invisivel (só aparece selecionando o texto), invertido (de cabeça para baixo)
//   cores:   nomes de CORES_TEXTO abaixo ou código, ex.: #ff8800
//   dá para combinar separando por espaço: [[vermelho negrito aura:CUIDADO]]
const CORES_TEXTO = {
  vermelho: "#ff6b5e", laranja: "#ff9f43", amarelo: "#ffd54a", verde: "#5cd67e", azul: "#5aa9ff",
  ciano: "#4fd8e8", roxo: "#b388ff", rosa: "#ff7eb6", marrom: "#c98a55", cinza: "#a8a29a",
  branco: "#ffffff", dourado: "#f2c14e",
};
const FORMAS = ["negrito", "italico", "sublinhado", "riscado", "grande", "pequeno", "segredo", "invisivel", "invertido"];
const semAcento = t => t.normalize("NFD").replace(/\p{M}/gu, "");   // tira acentos: "itálico" → "italico"

// Lê os estilos antes dos ":"; devolve null se algum não for um estilo conhecido
function lerEstilos(prefixo) {
  const tokens = semAcento(prefixo.trim().toLowerCase()).split(/\s+/);
  const est = { brilho: null, cor: null, formas: new Set() };
  for (const t of tokens) {
    if (BRILHOS.includes(t)) est.brilho = est.brilho || t;
    else if (FORMAS.includes(t)) est.formas.add(t);
    else if (CORES_TEXTO[t]) est.cor = CORES_TEXTO[t];
    else if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(t)) est.cor = t;
    else return null;
  }
  return est;
}

function aplicarEstilos(est, texto) {
  const classes = [], estilo = [];
  if (est.brilho) classes.push(`brilho-${est.brilho}`);
  if (est.cor) estilo.push(est.brilho ? `--gold:${est.cor}` : `color:${est.cor}`);
  const f = est.formas;
  if (f.has("negrito")) estilo.push("font-weight:700");
  if (f.has("italico")) estilo.push("font-style:italic");
  const linhas = [f.has("sublinhado") && "underline", f.has("riscado") && "line-through"].filter(Boolean);
  if (linhas.length) estilo.push(`text-decoration:${linhas.join(" ")}`);
  if (f.has("grande")) estilo.push("font-size:1.35em");
  if (f.has("pequeno")) estilo.push("font-size:.8em");
  if (f.has("segredo")) classes.push("segredo");
  if (f.has("invisivel")) classes.push("invisivel");
  if (f.has("invertido")) classes.push("invertido");
  const attrs = (classes.length ? ` class="${classes.join(" ")}"` : "") + (estilo.length ? ` style="${estilo.join(";")}"` : "")
    + (f.has("segredo") ? ` title="Toque para revelar"` : "");
  // <wbr> = a linha pode quebrar ali. Assim, um texto que usa [[invisivel:...]]
  // no lugar dos espaços não vira uma "palavra" gigante que vaza do cartão.
  // A quebra fica só DEPOIS do invisível, para nenhuma linha começar com um "buraco".
  const quebra = f.has("invisivel") ? "<wbr>" : "";
  return `<span${attrs}>${texto}</span>${quebra}`;
}

// O texto é protegido (esc) ANTES, então só os colchetes viram efeito.
function textoRico(s) {
  const padrao = BRILHOS.includes(BRILHO_PADRAO) ? BRILHO_PADRAO : "aura";
  return esc(s)
    // endereços que começam com http:// ou https:// viram links clicáveis (abrem em outra aba);
    // pontuação no fim (. , ! ? ; : )) fica fora do link
    .replace(/https?:\/\/[^\s<\]]+/gi, url => {
      const fim = (url.match(/[.,!?;:)]+$/) || [""])[0];
      const link = fim ? url.slice(0, -fim.length) : url;
      return `<a class="link-auto" href="${link}" target="_blank" rel="noopener noreferrer">${link}</a>${fim}`;
    })
    .replace(/\[\[([^\]]+?)\]\]/g, (_, dentro) => {
      const i = dentro.indexOf(":");
      const est = i > 0 ? lerEstilos(dentro.slice(0, i)) : null;
      if (est && dentro.slice(i + 1).trim()) return aplicarEstilos(est, dentro.slice(i + 1));
      return `<span class="brilho-${padrao}">${dentro}</span>`;   // sem estilo: brilho padrão
    });
}
function etiquetas(o) {
  const lista = opcoes(o.categorias || [], () => 0);   // sem repetidos, na ordem cadastrada
  return lista.length ? `<span class="tags">${lista.map(op => etiqueta(op.chave)).join("")}</span>` : "";
}
function pontoCor(chave) {
  const cor = corValida((coresCat.get(chave) || {}).cor);
  return cor ? `<span class="cor-dot" style="background:${cor}"></span>` : "";
}

// ---- Pistas: apoio ----
const ehLink = s => /^https?:\/\//i.test(String(s ?? "").trim());
function youtubeId(u) {
  const m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/i.exec(String(u ?? ""));
  return m ? m[1] : null;
}
const temPistaNova = () => pistas.some(p => !p.vista);

// Toque num [[segredo:...]] revela o texto (e não abre a pista)
document.addEventListener("click", e => {
  const seg = e.target.closest(".segredo:not(.revelado)");
  if (!seg) return;
  seg.classList.add("revelado");
  e.stopPropagation(); e.preventDefault();
}, true);

// Data em que a pista foi postada + etiquetas de teste (só aparecem para contas debugger)
function metaPista(p) {
  const quando = new Date(p.publicada_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const d = new Date(p.publicada_em);
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (p.agendada ? "" : data)
    + (p.oculta ? `<span class="etq-teste">🙈 Oculta</span>` : "")
    + (p.agendada ? `<span class="etq-teste agendada">⏰ Agendada · ${quando}</span>` : "");
}

// Etiqueta de dificuldade da pista (o banco guarda "facil", "medio", "dificil" ou "extrema")
const DIFICULDADES = { facil: "Fácil", medio: "Médio", dificil: "Difícil", extrema: "Extrema" };
const difDe = p => { const d = norm(p.dificuldade); return DIFICULDADES[d] ? d : null; };
function dificuldadePista(p) {
  const d = difDe(p);
  return d ? `<div class="pista-dif"><span class="tag dif-${d}">${DIFICULDADES[d]}</span></div>` : "";
}

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function traduzErro(e) {
  const m = (e && e.message) || String(e);
  if (/invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
  if (/already registered|already exists/i.test(m)) return "Já existe uma conta com este e-mail.";
  if (/at least 6 characters/i.test(m)) return "A senha da conta precisa ter pelo menos 6 caracteres.";
  if (/email not confirmed/i.test(m)) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (/rate limit|too many/i.test(m)) return "Muitas tentativas. Espere um pouco e tente de novo.";
  if (/failed to fetch|network/i.test(m)) return "Sem conexão com o servidor. Verifique sua internet.";
  return m;
}

// Ovo da sombra: enquanto está bloqueado, a sombra dele tem um "?" e pode ser tocada
const OVO_DA_SOMBRA = 17;
const ehSombraViva = o => !achou(o) && o.numero === OVO_DA_SOMBRA;
const SOMBRA_INTERROGACAO = "/sombra-ovo-17.png";   // fica na raiz do site, no GitHub

// Imagem do ovo: descoberto → imagem dele; não descoberto → sombra; sem arquivo → vazio
function figura(o, grande = false) {
  const cls = "pic" + (grande ? " big" : "");
  if (ehSombraViva(o)) return `<div class="${cls}"><img src="${SOMBRA_INTERROGACAO}" alt=""></div>`;
  if (achou(o) && o.imagemUrl) return `<div class="${cls}"><img src="${esc(o.imagemUrl)}" alt=""></div>`;
  if (!achou(o) && o.sombraUrl) return `<div class="${cls}"><img class="sombra" src="${esc(o.sombraUrl)}" alt=""></div>`;
  return `<div class="${cls}"></div>`;
}

// ---- Banco de dados ----
async function linksTemporarios(pasta, caminhos) {
  if (!caminhos.length) return {};
  const { data } = await sb.storage.from(pasta).createSignedUrls(caminhos, 60 * 60 * 24);
  const mapa = {};
  (data || []).forEach(l => { if (l.signedUrl && !l.error) mapa[l.path] = l.signedUrl; });
  return mapa;
}

// comImagens: também busca as cores das categorias e os links das imagens (só a página Ovos precisa)
async function carregarOvos(comImagens = false) {
  const { data, error } = await sb.rpc("listar_ovos");
  if (error) throw error;
  ovos = data || [];
  if (!comImagens) return;
  const { data: cores } = await sb.rpc("cores_categorias");   // se der erro, fica sem cores
  coresCat = new Map((cores || []).map(c => [norm(c.nome), c]));
  const [imagens, sombras] = await Promise.all([
    linksTemporarios("ovos", ovos.filter(o => achou(o) && o.imagem).map(o => o.imagem)),
    linksTemporarios("sombras", ovos.some(o => !achou(o)) ? ["sombra.png"] : [])
  ]);
  ovos.forEach(o => {
    o.imagemUrl = imagens[o.imagem];
    o.sombraUrl = sombras["sombra.png"];
  });
}

// comCapas: também busca os links das capas (só a página Pistas precisa)
async function carregarPistas(comCapas = false) {
  const { data, error } = await sb.rpc("listar_pistas");
  if (error) throw error;
  pistas = data || [];
  if (!comCapas) return;
  const capas = [...new Set(pistas.map(p => (p.imagens || [])[0]).filter(c => c && !ehLink(c)))];
  const links = await linksTemporarios("pistas", capas);
  pistas.forEach(p => {
    const c = (p.imagens || [])[0];
    p.capaUrl = c ? (ehLink(c) ? c.trim() : links[c]) : null;
  });
}

// ---- Cabeçalho: "Olá, nome", a engrenagem da conta e as abas ----
// Cada aba é uma página. Configurações fica na engrenagem, fora das abas.
const ABAS = [
  { id: "pistas",  icone: "lupa",   nome: "Pistas" },
  { id: "chave",   icone: "chave",  nome: "Chave" },
  { id: "ovos",    icone: "ovo",    nome: "Ovos" },
  { id: "ranking", icone: "trofeu", nome: "Ranking" },
];
function desenharTopo() {
  const atual = id => PAGINA === id ? ` aria-current="page"` : "";
  document.getElementById("saudacao").innerHTML = sessao
    ? `Olá, ${esc(nomeUsuario())}<a class="btn-conta" href="/conta/" aria-label="Configurações da conta" title="Configurações"${atual("conta")}>${ic("engrenagem")}</a>`
      + (souDebugger ? `<a class="btn-conta" href="/admin/" aria-label="Administração" title="Administração"${atual("admin")}>${ic("escudo")}</a>` : "")
    : "";
  const n = ovos.filter(achou).length;
  const extra = id =>
    id === "ovos" && ovos.length ? ` <span class="cont">(${n}/${ovos.length})</span>`
    : id === "pistas" && temPistaNova() ? `<span class="ponto" aria-label="Pistas novas"></span>` : "";
  document.getElementById("cabecalho").innerHTML = `
    <nav class="tabs" aria-label="Seções do jogo">
      ${ABAS.map(a => `<a class="tab" href="/${a.id}/"${atual(a.id)}>${ic(a.icone)} ${a.nome}${extra(a.id)}</a>`).join("")}
    </nav>`;
}

// Mensagem de erro no lugar do conteúdo, com um botão para tentar de novo
function mostrarFalha(msg) {
  app.innerHTML = `<div class="card center estreito"><h2>Ops!</h2><p class="sub">${esc(msg)}</p>
    <button class="btn" id="tentar">Tentar de novo</button></div>`;
  document.getElementById("tentar").onclick = () => location.reload();
}

// Abre uma página do jogo: confere o login e carrega os ovos e as pistas.
// Sem login, volta para a entrada. Devolve true se a página pode ser desenhada.
async function iniciarPagina({ imagensOvos = false, capasPistas = false } = {}) {
  if (!sb) { mostrarFalha("Não foi possível carregar o jogo. Verifique sua internet."); return false; }
  const { data } = await sb.auth.getSession();
  sessao = data.session;
  if (!sessao) { location.replace("/"); return false; }
  desenharTopo();
  app.innerHTML = `<p class="sub center" style="margin-top:40px">Carregando…</p>`;
  try {
    // as pistas não podem impedir o jogo de abrir (ex.: SQL das pistas ainda não rodado)
    await Promise.all([
      carregarOvos(imagensOvos),
      carregarPistas(capasPistas).catch(() => { pistas = []; }),
      // conta debugger vê o ícone da administração (se der erro, só não mostra)
      sb.rpc("sou_debugger").then(({ data }) => { souDebugger = data === true; }, () => {}),
    ]);
  } catch (err) {
    mostrarFalha(traduzErro(err));
    return false;
  }
  desenharTopo();
  return true;
}

// Sai da conta e volta para a entrada (a mensagem aparece lá)
async function sair(msg = "", tipo = "ok") {
  try { await sb.auth.signOut(); } catch { /* sai mesmo assim */ }
  try { if (msg) sessionStorage.setItem("aviso", JSON.stringify({ msg, tipo })); } catch { /* sem memória */ }
  location.replace("/");
}

// Volta para a lista (ex.: /pistas/). Se a pessoa veio dela, usa o "voltar" do navegador.
function voltarPara(caminho) {
  try {
    if (document.referrer && new URL(document.referrer).pathname === caminho && history.length > 1) return history.back();
  } catch { /* segue abaixo */ }
  location.assign(caminho);
}

// ---- Selo mágico (usado na entrada e na página Chave) ----
// Selo mágico: anel com 6 ovinhos (gira), hexagrama (gira ao contrário) e um ovo no centro
const OVINHO = "M0 -8.5C-4.6 -8.5 -7.4 -1.2 -7.4 2.6c0 4.2 3.3 6.6 7.4 6.6s7.4-2.4 7.4-6.6C7.4 -1.2 4.6 -8.5 0 -8.5z";
const SIGILO = (() => {
  const ovinhos = [-60, 0, 60, 120, 180, 240].map(a => {
    const r = a * Math.PI / 180, x = (100 + 91 * Math.cos(r)).toFixed(1), y = (100 + 91 * Math.sin(r)).toFixed(1);
    return `<path d="${OVINHO}" transform="translate(${x} ${y}) rotate(${a + 90})" fill="currentColor"/>`;
  }).join("");
  return `
    <svg class="sigilo" id="sigilo" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <filter id="sg-brilho" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.8" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g filter="url(#sg-brilho)" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
        <g class="sg-anel">
          <circle cx="100" cy="100" r="95"/>
          <circle cx="100" cy="100" r="87" stroke-width="2.4" stroke-dasharray="1.5 6"/>
          ${ovinhos}
        </g>
        <g class="sg-estrela">
          <polygon points="100,22 167.5,139 32.5,139"/>
          <polygon points="100,178 167.5,61 32.5,61"/>
          <circle cx="100" cy="22" r="3.2"/><circle cx="167.5" cy="139" r="3.2"/><circle cx="32.5" cy="139" r="3.2"/>
        </g>
        <circle cx="100" cy="100" r="45"/>
        <g class="sg-centro">
          <path d="M100 64C84 64 73 90 73 105c0 16 12 27 27 27s27-11 27-27c0-15-11-41-27-41z" stroke-width="2"/>
        </g>
      </g>
    </svg>`;
})();

// Ovinho dourado usado nas faíscas
const OVO_ICONE = `<svg class="ovo-ic" viewBox="0 0 16 22" aria-hidden="true"><path d="M8 1C4 1 1.5 7.5 1.5 12c0 4.6 3 8.5 6.5 8.5s6.5-3.9 6.5-8.5C14.5 7.5 12 1 8 1z"/></svg>`;

const reduzirMovimento = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
const esperar = ms => new Promise(r => setTimeout(r, ms));

// Faísca que sobe do campo enquanto a pessoa digita
function soltarFaisca(caixa, campo) {
  if (reduzirMovimento()) return;
  const f = document.createElement("span");
  f.className = "faisca";
  f.innerHTML = OVO_ICONE;
  const c = campo.getBoundingClientRect(), b = caixa.getBoundingClientRect();
  f.style.left = (c.left - b.left + c.width / 2 + (Math.random() - .5) * c.width * .7) + "px";
  f.style.top = (c.top - b.top + 4) + "px";
  f.style.setProperty("--dx", ((Math.random() - .5) * 70).toFixed(0) + "px");
  caixa.appendChild(f);
  setTimeout(() => f.remove(), 1200);
}

// ---- Parede de hieróglifos de ovos (fundo abaixo das abas) ----
// Faixas separadas por linhas duplas, como numa parede egípcia, em amarelo-ocre
// com tinta "gasta" (o filtro de ruído apaga pedacinhos do desenho).
// A parede tem 4 faixas: as faixas 3 e 4 repetem as 1 e 2 deslocadas para o lado (como tijolos),
// para os desenhos não ficarem empilhados em colunas. Cada faixa deslocada tem uma cópia
// "dando a volta" (x - 480), para a emenda entre as repetições não aparecer.
const PAREDE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">
  <defs>
    <filter id="gasto" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="4" seed="7" result="ruido"/>
      <feColorMatrix in="ruido" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.2 2.25" result="mascara"/>
      <feComposite in="SourceGraphic" in2="mascara" operator="in"/>
    </filter>
    <path id="ovo" d="M0 -20c-8 0-13 13-13 21 0 8 6 13 13 13s13-5 13-13c0-8-5-21-13-21z"/>
    <g id="faixa1">
    <rect x="0" y="0" width="480" height="3" stroke="none"/>
    <rect x="0" y="8" width="480" height="1.5" stroke="none"/>

    <!-- pessoa em pé erguendo um ovo -->
    <use href="#ovo" transform="translate(50 26) scale(.75)"/>
    <circle cx="50" cy="47" r="7" stroke="none"/>
    <path d="M44 55H56L54 80H46Z" stroke="none"/>
    <path d="M45 78H55L59 90H41Z" stroke="none"/>
    <path d="M45 57L37 42L40 30M55 57L63 42L60 30" fill="none" stroke-width="3.5"/>
    <path d="M46 90L45 106M54 90L56 106M41 106H47M54 106H61" fill="none" stroke-width="4"/>
    <use href="#ovo" transform="translate(108 82) scale(1.1)"/>
    <rect x="140" y="22" width="60" height="80" rx="28" fill="none" stroke-width="3"/>
    <line x1="146" y1="108" x2="194" y2="108" stroke-width="4"/>
    <use href="#ovo" transform="translate(170 44) scale(.6)"/>
    <path d="M152 64l6-5 6 5 6-5 6 5 6-5 6 5" fill="none" stroke-width="2.5"/>
    <use href="#ovo" transform="translate(160 88) scale(.48)"/>
    <use href="#ovo" transform="translate(180 88) scale(.48)"/>
    <use href="#ovo" transform="translate(245 44) scale(.75)" fill="none" stroke-width="5"/>
    <path d="M245 56V104M232 68H258" fill="none" stroke-width="5"/>
    <use href="#ovo" transform="translate(300 82) scale(1.1)"/>
    <path d="M288 80l4-5 4 6 4-6 4 5 4-5 4 4" fill="none" stroke="#8c6a1c" stroke-width="2.2"/>
    <!-- cesto com ovos -->
    <path d="M330 92Q365 112 400 92L396 101Q365 120 334 101Z" stroke="none"/>
    <path d="M340 100L344 108M356 103L357 112M372 103L371 112M388 100L384 108" fill="none" stroke="#8c6a1c" stroke-width="1.6"/>
    <use href="#ovo" transform="translate(347 88) scale(.55)"/>
    <use href="#ovo" transform="translate(365 84) scale(.6)"/>
    <use href="#ovo" transform="translate(383 88) scale(.55)"/>
    <!-- juncos -->
    <path d="M422 104C416 80 418 50 426 28C432 50 432 80 426 104ZM442 104C436 80 438 50 446 28C452 50 452 80 446 104ZM462 104C456 80 458 50 466 28C472 50 472 80 466 104Z" stroke="none"/>
    </g>
    <g id="faixa2"><g transform="translate(0 -120)">
    <rect x="0" y="120" width="480" height="3" stroke="none"/>
    <rect x="0" y="128" width="480" height="1.5" stroke="none"/>

    <!-- ovo-sol -->
    <use href="#ovo" transform="translate(52 188)"/>
    <path d="M52 152V160M52 206V214M18 185H26M78 185H86M28 160L34 166M76 160L70 166M28 208L34 202M76 208L70 202" fill="none" stroke-width="3"/>
    <!-- pessoa sentada segurando um ovo -->
    <circle cx="122" cy="168" r="7" stroke="none"/>
    <path d="M115 176H128L130 200H115Z" stroke="none"/>
    <path d="M115 198H142V206H115Z" stroke="none"/>
    <path d="M136 206H142V224H136Z" stroke="none"/>
    <path d="M133 224H147" fill="none" stroke-width="3"/>
    <rect x="102" y="204" width="13" height="20" stroke="none"/>
    <path d="M126 181L138 189L146 184" fill="none" stroke-width="3.5"/>
    <use href="#ovo" transform="translate(151 178) scale(.5)"/>
    <!-- pirâmide com um ovo no topo -->
    <path d="M175 224L197 182L219 224Z" stroke="none"/>
    <path d="M187 202H207M181 213H213" fill="none" stroke="#8c6a1c" stroke-width="1.6"/>
    <use href="#ovo" transform="translate(197 168) scale(.45)"/>
    <!-- água e ovo -->
    <path d="M230 160l6-6 6 6 6-6 6 6 6-6 6 6 6-6 6 6 6-6 6 6M230 176l6-6 6 6 6-6 6 6 6-6 6 6 6-6 6 6 6-6 6 6" fill="none" stroke-width="2.5"/>
    <use href="#ovo" transform="translate(260 206) scale(.8)"/>
    <!-- pessoa ajoelhada oferecendo um ovo -->
    <circle cx="346" cy="176" r="7" stroke="none"/>
    <path d="M340 184H352L354 207H340Z" stroke="none"/>
    <path d="M341 203L354 206L336 221L328 218Z" stroke="none"/>
    <rect x="326" y="218" width="40" height="6" rx="2" stroke="none"/>
    <path d="M342 189L328 196L320 192" fill="none" stroke-width="3.5"/>
    <use href="#ovo" transform="translate(313 190) scale(.5)"/>
    <rect x="396" y="152" width="66" height="60" rx="28" fill="none" stroke-width="3"/>
    <line x1="468" y1="158" x2="468" y2="206" stroke-width="4"/>
    <use href="#ovo" transform="translate(414 186) scale(.5)"/>
    <use href="#ovo" transform="translate(429 186) scale(.5)"/>
    <use href="#ovo" transform="translate(444 186) scale(.5)"/>
    </g></g>
  </defs>
  <g fill="#d9ad45" stroke="#d9ad45" stroke-linecap="round" stroke-linejoin="round" filter="url(#gasto)">
    <use href="#faixa1"/>
    <use href="#faixa2" y="120"/>
    <use href="#faixa1" x="170" y="240"/><use href="#faixa1" x="-310" y="240"/>
    <use href="#faixa2" x="290" y="360"/><use href="#faixa2" x="-190" y="360"/>
  </g>
</svg>`;
document.body.style.setProperty("--parede", `url("data:image/svg+xml,${encodeURIComponent(PAREDE_SVG)}")`);

// A parede começa logo abaixo do papel do cabeçalho, em todas as páginas (também na entrada)
function ajustarParede() {
  const papel = document.querySelector(".papel-sombra");
  if (!papel) return;
  document.body.style.setProperty("--corte", (papel.getBoundingClientRect().bottom + window.scrollY + 6) + "px");
  document.body.classList.add("com-parede");
}
new MutationObserver(ajustarParede).observe(app, { childList: true });
new MutationObserver(ajustarParede).observe(document.getElementById("cabecalho"), { childList: true });
addEventListener("resize", ajustarParede);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustarParede);

// Desenha as abas já, antes de os dados chegarem, para a página não "pular"
if (PAGINA !== "entrada") desenharTopo();
