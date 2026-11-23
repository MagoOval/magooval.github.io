// Página Pistas: a lista (/pistas/) e uma pista aberta (/pistas/?id=12).
// Ordem das pistas: "antigas" (padrão) ou "novas". Lembrada neste aparelho, se possível.
let ordemPistas = (() => { try { return localStorage.getItem("ordemPistas") === "novas" ? "novas" : "antigas"; } catch { return "antigas"; } })();
let filtroDif = new Set();         // dificuldades marcadas no filtro das pistas ("facil", "medio", "dificil")
let mostrarFiltrosPistas = false;

const render = () => telaPistas();

// ---- Tela 3: Pistas (lista estilo Reddit) ----
function cartaoPista(p) {
  const qtdImagens = (p.imagens || []).length;
  // o cartão mostra só tempo, título e descrição (sem a linha de "enigma / imagens / áudio...")
  return `
    <div class="pista ${p.vista ? "" : "nova"}" role="link" tabindex="0" data-id="${p.id}">
      <div class="pista-texto">
        <div class="pista-meta">${metaPista(p)}</div>
        ${dificuldadePista(p)}
        <div class="pista-titulo">${textoRico(p.titulo)}</div>
        ${p.descricao ? `<div class="pista-desc">${textoRico(p.descricao)}</div>` : ""}
      </div>
      ${p.capaUrl ? `
        <div class="pista-capa">
          <img src="${esc(p.capaUrl)}" alt="" loading="lazy">
          ${qtdImagens > 1 ? `<span class="capa-cont">🖼 ${qtdImagens}</span>` : ""}
        </div>` : ""}
      ${p.vista ? "" : `<span class="ponto" aria-label="Pista nova"></span>`}
    </div>`;
}

function telaPistas() {
  const sentido = ordemPistas === "novas" ? -1 : 1;
  // Filtro de dificuldade: só aparecem as dificuldades que alguma pista tem, na ordem Fácil → Extrema
  const difs = Object.keys(DIFICULDADES).filter(d => pistas.some(p => difDe(p) === d))
    .map(d => ({ chave: d, rotulo: DIFICULDADES[d] }));
  [...filtroDif].forEach(k => { if (!difs.some(op => op.chave === k)) filtroDif.delete(k); });
  const n = filtroDif.size;
  const ordenadas = [...pistas]
    .filter(p => !n || filtroDif.has(difDe(p)))
    .sort((a, b) => sentido * ((new Date(a.publicada_em) - new Date(b.publicada_em)) || (a.id - b.id)));
  app.innerHTML = `
    <div class="pistas-wrap">
      <div class="pistas-head">
        <h2>Pistas</h2>
        ${pistas.length ? `<div class="filter-actions">
          <button class="btn-filtros ${n ? "ativo" : ""}" id="bf-pistas" aria-expanded="${mostrarFiltrosPistas}">${ICONE_FUNIL} Filtros${n ? ` (${n})` : ""}</button>
          ${pistas.length > 1 ? `<button class="btn-filtros" id="ordem" title="Inverter a ordem">
            ⇅ ${ordemPistas === "novas" ? "Mais novas primeiro" : "Mais antigas primeiro"}</button>` : ""}
        </div>` : ""}
      </div>
      ${mostrarFiltrosPistas && pistas.length ? `
        <div class="slicers pistas-filtro">
          ${painel("Dificuldade", "d", difs, filtroDif, "Nenhuma pista tem dificuldade ainda.")}
        </div>` : ""}
      ${!pistas.length
        ? `<div class="card empty">Nenhuma pista por enquanto. Volte mais tarde!</div>`
        : ordenadas.length
          ? `<div class="pistas">${ordenadas.map(cartaoPista).join("")}</div>`
          : `<div class="card empty">Nenhuma pista com essa dificuldade.</div>`}
    </div>`;
  const botaoFiltros = document.getElementById("bf-pistas");
  if (botaoFiltros) botaoFiltros.onclick = () => { mostrarFiltrosPistas = !mostrarFiltrosPistas; render(); };
  document.querySelectorAll('.slicer-item[data-tipo="d"]').forEach(b => b.onclick = () => {
    filtroDif.has(b.dataset.valor) ? filtroDif.delete(b.dataset.valor) : filtroDif.add(b.dataset.valor);
    render();
  });
  document.querySelectorAll('[data-limpar="d"]').forEach(b => b.onclick = () => { filtroDif.clear(); render(); });
  const botaoOrdem = document.getElementById("ordem");
  if (botaoOrdem) botaoOrdem.onclick = () => {
    ordemPistas = ordemPistas === "novas" ? "antigas" : "novas";
    try { localStorage.setItem("ordemPistas", ordemPistas); } catch { /* sem memória neste aparelho */ }
    render();
  };
  document.querySelectorAll(".pista").forEach(el => {
    // clicar num link dentro do cartão abre só o link (não abre a pista junto)
    // quem arrastou para selecionar texto (ex.: texto invisível) também não abre a pista
    el.onclick = e => {
      if (e.target.closest("a")) return;
      if (String(window.getSelection() || "").trim()) return;
      location.assign(`/pistas/?id=${el.dataset.id}`);
    };
    el.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); location.assign(`/pistas/?id=${el.dataset.id}`); } };
  });
}

// ---- Pista aberta ----
async function abrirPista(id) {
  const p = pistas.find(x => x.id === id);
  if (!p) { history.replaceState(null, "", "/pistas/"); return telaPistas(); }
  if (!p.vista) {
    p.vista = true;   // o ponto vermelho some na hora; o banco é avisado em seguida
    desenharTopo();
    sb.rpc("marcar_pista_vista", { p_id: id }).then(({ error }) => { if (error) console.warn(error); });
  }
  app.innerHTML = `<p class="sub center" style="margin-top:40px" id="abrindo-pista">Abrindo pista…</p>`;

  const arquivos = [...(p.imagens || []), p.video, p.audio].filter(c => c && !ehLink(c) && !youtubeId(c));
  const links = await linksTemporarios("pistas", [...new Set(arquivos)]);
  const url = c => !c ? null : (ehLink(c) ? c.trim() : links[c] || null);

  const imagens = (p.imagens || []).map(url).filter(Boolean)
    .map(u => `<img class="pista-img" src="${esc(u)}" alt="">`).join("");
  const yt = youtubeId(p.video);
  const video = yt
    ? `<iframe class="pista-video" src="https://www.youtube-nocookie.com/embed/${yt}" title="Vídeo da pista"
         allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
    : url(p.video) ? `<video class="pista-video" controls preload="metadata" src="${esc(url(p.video))}"></video>` : "";
  const audio = url(p.audio) ? `<audio controls preload="metadata" src="${esc(url(p.audio))}"></audio>` : "";
  const link = ehLink(p.link)
    ? `<a class="pista-link" href="${esc(p.link.trim())}" target="_blank" rel="noopener noreferrer">🔗 ${esc(p.link_texto || p.link)}</a>` : "";

  if (!document.getElementById("abrindo-pista")) return;   // a pessoa trocou de tela enquanto carregava
  app.innerHTML = `
    <article class="card pista-det">
      <button class="link" id="voltar">← Voltar para as pistas</button>
      <div class="pista-meta" style="margin-top:8px">${metaPista(p)}</div>
      ${dificuldadePista(p)}
      <h2>${textoRico(p.titulo)}</h2>
      ${p.descricao ? `<p class="pista-lead">${textoRico(p.descricao)}</p>` : ""}
      ${p.texto ? `<p class="desc">${textoRico(p.texto)}</p>` : ""}
      ${imagens}${video}${audio}${link}
      ${p.enigma_tipo ? `<div id="enigma"></div>` : ""}
    </article>`;
  document.getElementById("voltar").onclick = () => voltarPara("/pistas/");
  if (p.enigma_tipo) montarEnigma(p);
}

// ---- Enigmas (pistas interativas) ----
const NOMES_ENIGMA = { charada: "Charada", cadeado_numeros: "Cadeado", cadeado_simbolos: "Cadeado de símbolos", cifra: "Mensagem cifrada" };
// nome do símbolo (usado na resposta) → desenho
const SIMBOLOS = {
  ovo: "🥚", lua: "🌙", sol: "☀️", estrela: "⭐", coroa: "👑", coracao: "❤️", chave: "🔑",
  olho: "👁️", fogo: "🔥", agua: "💧", folha: "🍃", caveira: "💀", raio: "⚡", flor: "🌸"
};

// Cifra de César (igual à do banco): cada letra anda "d" casas no alfabeto
function cesar(texto, d) {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[a-z]/gi, ch => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode(base + ((ch.charCodeAt(0) - base + d) % 26 + 26) % 26);
  });
}

// Rodinha de cadeado: setas para cima/baixo trocam o valor
const rodinha = (i, mostra) => `
  <div class="rodinha" data-i="${i}">
    <button type="button" class="giro" data-d="1" aria-label="Próximo">▲</button>
    <span class="valor" aria-live="polite">${mostra}</span>
    <button type="button" class="giro" data-d="-1" aria-label="Anterior">▼</button>
  </div>`;

function montarEnigma(p) {
  const alvo = document.getElementById("enigma");
  if (!alvo) return;
  if (p.resolvida) return mostrarRecompensa(alvo, p, false);
  const cfg = p.enigma_config || {};
  let corpo = "", textoBotao = "Responder", lerResposta;
  let opcoes = null, valores = null, mostrar = v => v;   // usados pelos cadeados

  if (p.enigma_tipo === "cadeado_numeros") {
    const n = Math.min(Math.max(parseInt(cfg.digitos, 10) || 4, 1), 8);
    opcoes = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    valores = Array(n).fill(0);
    corpo = `<div class="cadeado">${valores.map((_, i) => rodinha(i, "0")).join("")}</div>`;
    textoBotao = "🔓 Abrir cadeado";
    lerResposta = () => valores.map(v => opcoes[v]).join("");
  } else if (p.enigma_tipo === "cadeado_simbolos") {
    opcoes = (Array.isArray(cfg.simbolos) && cfg.simbolos.length ? cfg.simbolos : Object.keys(SIMBOLOS))
      .map(s => norm(s)).filter(s => SIMBOLOS[s]);
    const n = Math.min(Math.max(parseInt(cfg.posicoes, 10) || 3, 1), 8);
    valores = Array(n).fill(0);
    mostrar = v => SIMBOLOS[v] || "?";
    corpo = `<div class="cadeado simbolos">${valores.map((_, i) => rodinha(i, mostrar(opcoes[0]))).join("")}</div>`;
    textoBotao = "🔓 Abrir cadeado";
    lerResposta = () => valores.map(v => opcoes[v]).join(" ");
  } else if (p.enigma_tipo === "cifra") {
    corpo = `
      <pre class="cifra-texto" id="cifra-original">${esc(cfg.mensagem || "")}</pre>
      <div class="decodificador">
        <span>Roda decodificadora:</span>
        <button type="button" class="giro" id="cifra-menos" aria-label="Voltar uma casa">◀</button>
        <b id="cifra-n">0</b>
        <button type="button" class="giro" id="cifra-mais" aria-label="Avançar uma casa">▶</button>
      </div>
      <pre class="cifra-texto decifrado" id="cifra-preview">${esc(cfg.mensagem || "")}</pre>
      <input id="enigma-resposta" autocomplete="off" spellcheck="false" placeholder="Sua resposta">`;
    lerResposta = () => document.getElementById("enigma-resposta").value;
  } else {   // charada
    corpo = `<input id="enigma-resposta" autocomplete="off" spellcheck="false" placeholder="Sua resposta">`;
    lerResposta = () => document.getElementById("enigma-resposta").value;
  }

  alvo.innerHTML = `
    <form class="enigma" id="enigma-form">
      <div class="enigma-titulo">🧩 ${NOMES_ENIGMA[p.enigma_tipo] || "Enigma"}</div>
      ${corpo}
      <div class="msg" id="enigma-msg" role="status"></div>
      <button class="btn btn-compacto" id="enigma-go">${textoBotao}</button>
    </form>`;

  // cadeados: girar as rodinhas
  alvo.querySelectorAll(".rodinha").forEach(r => {
    const i = +r.dataset.i;
    r.querySelectorAll(".giro").forEach(b => b.onclick = () => {
      valores[i] = (valores[i] + +b.dataset.d + opcoes.length) % opcoes.length;
      r.querySelector(".valor").textContent = mostrar(opcoes[valores[i]]);
    });
  });
  // cifra: girar a roda decodificadora
  if (p.enigma_tipo === "cifra") {
    let d = 0;
    const atualizar = () => {
      document.getElementById("cifra-n").textContent = d;
      document.getElementById("cifra-preview").textContent = cesar(cfg.mensagem || "", -d);
    };
    document.getElementById("cifra-menos").onclick = () => { d = (d + 25) % 26; atualizar(); };
    document.getElementById("cifra-mais").onclick = () => { d = (d + 1) % 26; atualizar(); };
  }

  const form = document.getElementById("enigma-form");
  form.onsubmit = async e => {
    e.preventDefault();
    const m = document.getElementById("enigma-msg"), go = document.getElementById("enigma-go");
    const resposta = lerResposta();
    if (!String(resposta).trim()) { m.className = "msg err"; m.textContent = "Escreva uma resposta primeiro."; return; }
    go.disabled = true; m.className = "msg"; m.textContent = "Verificando…";
    try {
      const { data, error } = await sb.rpc("responder_enigma", { p_id: p.id, p_resposta: resposta });
      if (error) throw error;
      if (data.status === "certo") {
        p.resolvida = true;
        p.recompensa_texto = data.recompensa_texto;
        p.recompensa_imagem = data.recompensa_imagem;
        return mostrarRecompensa(alvo, p, true);
      }
      if (data.status === "aguarde") { m.className = "msg err"; m.textContent = "Muitas tentativas seguidas. Espere um minuto."; }
      else if (data.status === "invalido") { m.className = "msg err"; m.textContent = "Este enigma ainda não tem resposta cadastrada."; }
      else {
        m.className = "msg err"; m.textContent = "Não foi dessa vez… tente de novo!";
        form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake");
      }
    } catch (err) {
      m.className = "msg err"; m.textContent = traduzErro(err);
    }
    go.disabled = false;
  };
}

async function mostrarRecompensa(alvo, p, novo) {
  let img = "";
  const c = p.recompensa_imagem;
  if (c) {
    const url = ehLink(c) ? c.trim() : (await linksTemporarios("recompensas", [c]))[c];
    if (url) img = `<img class="pista-img" src="${esc(url)}" alt="">`;
  }
  if (!document.body.contains(alvo)) return;   // a pessoa saiu da pista enquanto carregava
  alvo.innerHTML = `
    <div class="enigma resolvido ${novo ? "pop" : ""}">
      <div class="enigma-titulo">✅ Enigma resolvido!</div>
      ${p.recompensa_texto ? `<p class="desc">${textoRico(p.recompensa_texto)}</p>` : ""}
      ${img}
    </div>`;
}

iniciarPagina({ capasPistas: true }).then(ok => {
  if (!ok) return;
  const id = Number(new URLSearchParams(location.search).get("id"));
  if (id) abrirPista(id); else telaPistas();
});
