// Página Ovos: a coleção (/ovos/) e um ovo aberto (/ovos/?n=5).
let filtro = "todos";      // "todos" | "descobertos"
let filtroCategoria = new Set();   // categorias marcadas (em minúsculas)
// Ordem dos ovos: "numero" (padrão), "categoria" ou "obtencao". Lembrada neste aparelho, se possível.
let ordemOvos = (() => { try { const v = localStorage.getItem("ordemOvos"); return ["categoria", "obtencao"].includes(v) ? v : "numero"; } catch { return "numero"; } })();
let mostrarFiltros = false;

const totalFiltros = () => filtroCategoria.size;

// Vale "qualquer uma das categorias marcadas"
function passaFiltros(o) {
  if (!totalFiltros()) return true;
  if (!achou(o)) return false;
  return (o.categorias || []).some(c => filtroCategoria.has(norm(c)));
}

// ---- Ordenação dos ovos ----
const ORDENS = { numero: "Número", categoria: "Categoria", obtencao: "Obtenção" };
// Categoria "principal" de um ovo = a primeira em ordem alfabética
const catPrincipal = o => opcoes(o.categorias || [], porNome)[0] || null;
const porNumero = (a, b) => a.numero - b.numero;

// Devolve grupos [{ titulo, ovos }]. Só a ordem por categoria tem títulos.
function ordenarOvos(lista) {
  if (ordemOvos === "obtencao") {
    const achados = lista.filter(achou).sort((a, b) => new Date(a.encontrado_em) - new Date(b.encontrado_em) || porNumero(a, b));
    return [{ titulo: null, ovos: [...achados, ...lista.filter(o => !achou(o)).sort(porNumero)] }];
  }
  if (ordemOvos === "categoria") {
    const grupos = new Map();
    lista.filter(achou).sort(porNumero).forEach(o => {
      const c = catPrincipal(o);
      const chave = c ? c.chave : "";
      if (!grupos.has(chave)) grupos.set(chave, { chave, semCat: !c, ovos: [] });
      grupos.get(chave).ovos.push(o);
    });
    // ordem alfabética; "Sem categoria" sempre por último
    const ordenados = [...grupos.values()].sort((a, b) => (a.semCat - b.semCat) || a.chave.localeCompare(b.chave, "pt-BR"));
    // "titulo" já vem pronto em HTML (etiqueta colorida ou texto fixo)
    const resultado = ordenados.map(g => ({ titulo: g.semCat ? "Sem categoria" : etiqueta(g.chave), ovos: g.ovos }));
    const bloqueados = lista.filter(o => !achou(o)).sort(porNumero);
    if (bloqueados.length) resultado.push({ titulo: "Ainda não descobertos", ovos: bloqueados });
    return resultado;
  }
  return [{ titulo: null, ovos: [...lista].sort(porNumero) }];
}

const render = () => telaOvos();

// ---- Tela 2: Ovos ----
function cartaoOvo(o) {
  if (ehSombraViva(o)) {
    return `<button class="tile locked sombra-viva" aria-label="Ovo ${num(o)}, ainda não descoberto">
         ${figura(o)}
         <span class="num">${num(o)}</span>
         <span class="name">???</span>
       </button>`;
  }
  return achou(o)
    ? `<button class="tile" data-n="${o.numero}">
         ${figura(o)}
         <span class="num">${num(o)}</span>
         <span class="name">${textoRico(o.nome)}</span>
         ${etiquetas(o)}
       </button>`
    : `<div class="tile locked" aria-disabled="true" title="Ainda não descoberto">
         ${figura(o)}
         <span class="num">${num(o)}</span>
         <span class="name">???</span>
       </div>`;
}

function telaOvos() {
  const achados = ovos.filter(achou);
  const categorias = opcoes(achados.flatMap(o => o.categorias || []), porNome);
  // descarta marcações que não existem mais na lista
  [...filtroCategoria].forEach(k => { if (!categorias.some(op => op.chave === k)) filtroCategoria.delete(k); });

  const n = totalFiltros();
  const lista = (filtro === "descobertos" ? achados : ovos).filter(passaFiltros);
  const grupos = ordenarOvos(lista);
  app.innerHTML = `
    <div class="filter-bar">
      <h2>Ovos</h2>
      <div class="filter-actions">
        <label class="ordem-sel">Ordenar:
          <select id="ordem-ovos" aria-label="Ordenar ovos">
            ${Object.entries(ORDENS).map(([v, r]) => `<option value="${v}" ${ordemOvos === v ? "selected" : ""}>${r}</option>`).join("")}
          </select>
        </label>
        <button class="btn-filtros ${n ? "ativo" : ""}" id="bf" aria-expanded="${mostrarFiltros}">${ICONE_FUNIL} Filtros${n ? ` (${n})` : ""}</button>
        <div class="seg" role="group" aria-label="Mostrar ovos">
          <button data-f="todos" aria-pressed="${filtro === "todos"}">Todos (${ovos.length})</button>
          <button data-f="descobertos" aria-pressed="${filtro === "descobertos"}">Descobertos (${achados.length})</button>
        </div>
      </div>
    </div>
    ${mostrarFiltros ? `
      <div class="slicers">
        ${painel("Categoria", "c", categorias, filtroCategoria, "Nenhuma categoria descoberta ainda.")}
      </div>` : ""}
    ${n ? `<p class="filtro-nota">Com filtros, aparecem só os ovos já descobertos.<button class="link" id="limpar-tudo">Limpar filtros</button></p>` : ""}
    ${lista.length
      ? grupos.map(g => `
          ${g.titulo ? `<h3 class="grupo-titulo">${g.titulo}</h3>` : ""}
          <div class="grid">${g.ovos.map(cartaoOvo).join("")}</div>`).join("")
      : `<div class="grid">${n
          ? `<div class="card empty">Nenhum ovo descoberto com esses filtros.</div>`
          : `<div class="card empty">Você ainda não descobriu nenhum ovo.<br>Vá em “Chave” para começar!</div>`}</div>`}`;
  document.getElementById("ordem-ovos").onchange = e => {
    ordemOvos = e.target.value;
    try { localStorage.setItem("ordemOvos", ordemOvos); } catch { /* sem memória neste aparelho */ }
    render();
  };
  document.querySelectorAll(".seg button").forEach(b => b.onclick = () => { filtro = b.dataset.f; render(); });
  document.getElementById("bf").onclick = () => { mostrarFiltros = !mostrarFiltros; render(); };
  document.querySelectorAll(".slicer-item").forEach(b => b.onclick = () => {
    filtroCategoria.has(b.dataset.valor) ? filtroCategoria.delete(b.dataset.valor) : filtroCategoria.add(b.dataset.valor);
    render();
  });
  document.querySelectorAll("[data-limpar]").forEach(b => b.onclick = () => { filtroCategoria.clear(); render(); });
  const limparTudo = document.getElementById("limpar-tudo");
  if (limparTudo) limparTudo.onclick = () => { filtroCategoria.clear(); render(); };
  document.querySelectorAll("button.tile[data-n]").forEach(b => b.onclick = () => location.assign(`/ovos/?n=${b.dataset.n}`));
  document.querySelectorAll("button.sombra-viva").forEach(b => b.onclick = () => tocarSombra(b));
}

// Tocou na sombra do ovo: quem desbloqueia é o Supabase
async function tocarSombra(botao) {
  botao.disabled = true;
  try {
    const { data, error } = await sb.rpc("tocar_sombra");
    if (error) throw error;
    if (data?.numero) return location.assign(`/ovos/?n=${data.numero}${data.status === "novo" ? "&novo=1" : ""}`);
  } catch { /* avisa abaixo */ }
  botao.disabled = false;
  botao.querySelector(".name").textContent = "Tente de novo";
}

// ---- Detalhe de um ovo descoberto ----
function telaDetalhe(o, novo = false) {
  app.innerHTML = `
    <div class="card detalhe">
      <div class="center ${novo ? "pop" : ""}">
        ${figura(o, true)}
        ${novo ? `<p style="color:var(--ok);font-weight:700;margin:0 0 4px">${ic("brilho")} Ovo encontrado!</p>` : ""}
        <h2 style="margin-bottom:2px">${textoRico(o.nome)}</h2>
        <p class="sub" style="margin-bottom:0">${num(o)}</p>
        ${etiquetas(o)}
      </div>
      <div>
        <p class="desc">${textoRico(o.descricao)}</p>
        <p class="found-on">Você encontrou em ${dataHora(o.encontrado_em)}</p>
        <div id="zumbi"></div>
      </div>
      <div class="det-ranking">
        <h3>${ic("trofeu")}Quem encontrou primeiro</h3>
        <div id="rk"><p class="ranking-msg">Carregando ranking…</p></div>
        <button class="btn" id="ok">Ver todos os ovos</button>
      </div>
    </div>`;
  document.getElementById("ok").onclick = () => voltarPara("/ovos/");
  carregarRanking(o.numero);
  carregarContagio(o.numero);
}

// Ovo Zumbi: mostra a chave de contágio da pessoa (só aparece em ovos zumbi)
async function carregarContagio(numero) {
  const alvo = document.getElementById("zumbi");
  try {
    const { data, error } = await sb.rpc("meu_contagio", { p_numero: numero });
    if (error || !data?.zumbi || !document.body.contains(alvo)) return;
    const restam = Math.max(0, data.usos_max - data.usos);
    const origem = data.paciente_zero || !data.infectado_por
      ? "Você foi infectado pelo <strong>Paciente Zero</strong>."
      : `Você foi infectado por <strong>${esc(data.infectado_por)}</strong>.`;
    const vitimas = data.infectados.length
      ? `Você já infectou <strong>${data.infectados.length}</strong>: ${data.infectados.map(esc).join(", ")}.`
      : "Você ainda não infectou ninguém.";
    alvo.innerHTML = `
      <div class="contagio">
        <h3>🧟 Contágio</h3>
        ${restam > 0 ? `
          <p>Sua chave de contágio:</p>
          <div class="chave-zumbi">
            <code>${esc(data.chave)}</code>
            <button class="btn btn-compacto" type="button" id="copiarZumbi">Copiar</button>
          </div>
          <p class="sub">Restam <strong>${restam}</strong> de ${data.usos_max} infecções. Cada pessoa nova que usar gasta uma.</p>`
        : `<p>Sua chave <code>${esc(data.chave)}</code> já infectou ${data.usos_max} pessoas e morreu.</p>`}
        <p class="sub">${origem} ${vitimas}</p>
      </div>`;
    const b = document.getElementById("copiarZumbi");
    if (b) b.onclick = async () => {
      try { await navigator.clipboard.writeText(data.chave); b.textContent = "Copiada!"; }
      catch { b.textContent = "Selecione e copie"; }
      setTimeout(() => { b.textContent = "Copiar"; }, 1800);
    };
  } catch { /* sem contágio */ }
}

async function carregarRanking(numero) {
  const alvo = document.getElementById("rk");
  try {
    const { data, error } = await sb.rpc("ranking_ovo", { p_numero: numero });
    if (error) throw error;
    if (!document.body.contains(alvo)) return;   // usuário já saiu desta tela
    if (!data || !data.length) { alvo.innerHTML = `<p class="ranking-msg">Ninguém no ranking ainda.</p>`; return; }
    let anterior = 0, linhas = "";
    data.forEach(r => {
      if (r.posicao > anterior + 1) linhas += `<li class="gap">⋯</li>`;
      linhas += `<li class="${r.posicao == 1 ? "primeiro" : ""} ${r.sou_eu ? "eu" : ""}">
        <span class="pos">${medalhaDe(Number(r.posicao))}</span>
        <span class="quem">${esc(r.nome)}</span>
        <span class="quando">${dataHora(r.encontrado_em)}</span>
      </li>`;
      anterior = Number(r.posicao);
    });
    alvo.innerHTML = `<ol class="ranking">${linhas}</ol>`;
  } catch (err) {
    if (document.body.contains(alvo)) alvo.innerHTML = `<p class="ranking-msg">Não foi possível carregar o ranking.</p>`;
  }
}

iniciarPagina({ imagensOvos: true }).then(ok => {
  if (!ok) return;
  const q = new URLSearchParams(location.search);
  const n = Number(q.get("n"));
  const o = n ? ovos.find(x => x.numero === n && achou(x)) : null;
  if (o) {
    const novo = q.has("novo");
    if (novo) history.replaceState(null, "", `/ovos/?n=${n}`);   // recarregar não repete o "Ovo encontrado!"
    telaDetalhe(o, novo);
  } else {
    if (q.has("n")) history.replaceState(null, "", "/ovos/");
    telaOvos();
  }
});
