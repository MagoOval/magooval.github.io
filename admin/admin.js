// Página Administração (/admin/): só para contas debugger.
// Quem confere se a conta pode usar é o Supabase: cada função admin_* recusa quem não é debugger.
// Seções: jogadores, ovos, pistas, desafios, categorias, estatísticas e registro.
// O endereço guarda onde a pessoa está: #jogadores, #jogador/<id>, #ovo/5, #ovo/novo, #pista/12, #pista/nova...

const SECOES = [
  { id: "jogadores",    nome: "Jogadores" },
  { id: "ovos",         nome: "Ovos" },
  { id: "pistas",       nome: "Pistas" },
  { id: "desafios",     nome: "Desafios" },
  { id: "categorias",   nome: "Categorias" },
  { id: "estatisticas", nome: "Estatísticas" },
  { id: "registro",     nome: "Registro" },
];
// telas de detalhe ficam "dentro" de uma seção do menu
const SECAO_DE = { jogador: "jogadores", ovo: "ovos", pista: "pistas", desafio: "desafios" };

const NOMES_ENIGMA_ADMIN = { charada: "Charada", cadeado_numeros: "Cadeado de números", cadeado_simbolos: "Cadeado de símbolos", cifra: "Mensagem cifrada" };
const SIMBOLOS_NOMES = ["ovo", "lua", "sol", "estrela", "coroa", "coracao", "chave", "olho", "fogo", "agua", "folha", "caveira", "raio", "flor"];

// ---- Apoio ----
function rota() {
  const [secao, id] = location.hash.slice(1).split("/");
  return { secao: secao || "jogadores", id: id ? decodeURIComponent(id) : null };
}

async function chamar(nome, args) {
  const { data, error } = await sb.rpc(nome, args);
  if (error) throw error;
  return data;
}

const dataCurta = d => d ? dataHora(d) : "—";
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// Converte a data do banco para o campo "data e hora" do formulário (horário deste aparelho)
function paraCampoData(iso) {
  if (!iso) return "";
  const d = new Date(iso), z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

// Aviso no alto da página (some sozinho quando deu certo)
let tempoAviso;
function avisar(msg, tipo = "ok") {
  const a = document.getElementById("admin-aviso");
  if (!a) return;
  a.innerHTML = `<div class="msg ${tipo}" role="status">${esc(msg)}</div>`;
  clearTimeout(tempoAviso);
  if (tipo === "ok") tempoAviso = setTimeout(() => { a.innerHTML = ""; }, 4500);
}

// Botão de ação perigosa: o 1º clique pede confirmação, o 2º faz
function comConfirmacao(botao, textoConfirmar, acao) {
  const original = botao.innerHTML;
  let armado = false, tempo;
  botao.onclick = async () => {
    if (!armado) {
      armado = true;
      botao.classList.add("confirmar");
      botao.textContent = textoConfirmar;
      tempo = setTimeout(() => { armado = false; botao.classList.remove("confirmar"); botao.innerHTML = original; }, 4000);
      return;
    }
    clearTimeout(tempo);
    botao.disabled = true;
    await acao();
  };
}

// Roda uma ação do banco, avisa o resultado e redesenha a tela
async function executar(botao, acao, msgOk) {
  if (botao) botao.disabled = true;
  try {
    const r = await acao();
    avisar(typeof msgOk === "function" ? msgOk(r) : msgOk, "ok");
    await render();
  } catch (err) {
    avisar(traduzErro(err), "err");
    if (botao) botao.disabled = false;
  }
}

// Cores das categorias (para as etiquetas) e links das imagens dos ovos
async function carregarCores() {
  const cores = await chamar("cores_categorias").catch(() => []);
  coresCat = new Map((cores || []).map(c => [norm(c.nome), c]));
}

// Cifra de César (igual à do banco e à da página Pistas)
function cesarAdmin(texto, d) {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[a-z]/gi, ch => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode(base + ((ch.charCodeAt(0) - base + d) % 26 + 26) % 26);
  });
}

// =====================================================================
//  JOGADORES
// =====================================================================
let buscaJogadores = "";

async function telaJogadores() {
  const lista = await chamar("admin_jogadores", { p_busca: buscaJogadores || null });
  return {
    html: `
      <div class="admin-topo"><h2>Jogadores</h2><span class="sub" style="margin:0">${plural(lista.length, "conta", "contas")}</span></div>
      <form class="admin-busca" id="f-busca" role="search">
        <input id="busca" type="search" placeholder="Buscar por nome ou e-mail" value="${esc(buscaJogadores)}" aria-label="Buscar jogador">
        <button class="btn btn-compacto">Buscar</button>
      </form>
      <div class="admin-tabela-caixa"><table class="admin-tabela">
        <thead><tr><th>Nome</th><th>E-mail</th><th class="num">Ovos</th><th>Cadastro</th><th>Último acesso</th><th></th></tr></thead>
        <tbody>${lista.length ? lista.map(j => `
          <tr>
            <td>${esc(j.nome)}${j.debugger ? `<span class="selo-debugger">debugger</span>` : ""}</td>
            <td class="fraco">${esc(j.email || "—")}</td>
            <td class="num">${j.ovos}</td>
            <td class="fraco">${dataCurta(j.criado_em)}</td>
            <td class="fraco">${dataCurta(j.ultimo_acesso)}</td>
            <td class="acoes"><a class="bt" href="#jogador/${encodeURIComponent(j.id)}">Abrir</a></td>
          </tr>`).join("") : `<tr><td colspan="6" class="vazio">Nenhum jogador encontrado.</td></tr>`}
        </tbody>
      </table></div>`,
    ligar() {
      document.getElementById("f-busca").onsubmit = e => {
        e.preventDefault();
        buscaJogadores = document.getElementById("busca").value.trim();
        render();
      };
    }
  };
}

async function telaJogador(id) {
  const f = await chamar("admin_ficha_jogador", { p_id: id });
  const p = f.perfil;
  const achados = f.ovos.filter(o => o.encontrado_em).length;
  const lista = (itens, vazio, linha) => itens.length
    ? `<ul class="lista-simples">${itens.map(linha).join("")}</ul>` : `<p class="sub" style="margin:0">${vazio}</p>`;
  return {
    html: `
      <a class="admin-voltar" href="#jogadores">← Jogadores</a>
      <div class="card ficha-bloco">
        <div class="ficha-cabeca">
          <span class="nome">${esc(p.nome)}${p.debugger ? `<span class="selo-debugger">debugger</span>` : ""}${p.eu ? ` <span class="sub">(você)</span>` : ""}</span>
          <div class="ficha-dados">
            <span>${esc(p.email || "sem e-mail")}</span>
            <span>Cadastro: ${dataCurta(p.criado_em)}</span>
            <span>Último acesso: ${dataCurta(p.ultimo_acesso)}</span>
            <span>Ovos: ${achados}/${f.ovos.length}</span>
            <span>Pistas vistas: ${f.pistas_vistas}</span>
          </div>
        </div>
        <div class="botoes">
          <button class="bt" id="b-debugger" ${p.eu && p.debugger ? "disabled title=\"Você não pode tirar a sua própria marca\"" : ""}>
            ${p.debugger ? "Tirar a marca debugger" : "Marcar como debugger"}</button>
          <button class="bt" id="b-zerar">Zerar pistas vistas e enigmas</button>
          <button class="bt perigo" id="b-tirar-todos" ${achados ? "" : "disabled"}>Tirar todos os ovos</button>
        </div>
        <form class="linha-renomear" id="f-nome">
          <input id="novo-nome" maxlength="40" value="${esc(p.nome)}" aria-label="Nome de exibição">
          <button class="bt ouro">Salvar nome</button>
        </form>
      </div>

      <div class="ficha-grade">
        <div>
          <h3>Ovos</h3>
          <div class="admin-tabela-caixa"><table class="admin-tabela">
            <thead><tr><th>#</th><th>Ovo</th><th>Achou em</th><th></th></tr></thead>
            <tbody>${f.ovos.map(o => `
              <tr>
                <td class="fraco">${num(o)}</td>
                <td>${textoRico(o.nome)}</td>
                <td class="fraco">${o.encontrado_em ? dataCurta(o.encontrado_em) : "—"}</td>
                <td class="acoes">${o.encontrado_em
                  ? `<button class="bt perigo" data-tirar="${o.numero}">Tirar</button>`
                  : `<button class="bt ouro" data-dar="${o.numero}">Dar</button>`}</td>
              </tr>`).join("")}
            </tbody>
          </table></div>
        </div>
        <div>
          <div class="card ficha-bloco"><h3>Enigmas resolvidos</h3>
            ${lista(f.enigmas, "Nenhum ainda.", e => `<li><span>${textoRico(e.titulo)}</span><span class="fraco">${dataCurta(e.em)}</span></li>`)}</div>
          <div class="card ficha-bloco"><h3>Desafios completados</h3>
            ${lista(f.desafios, "Nenhum ainda.", d => `<li><span>${esc(d.titulo)}</span><span class="fraco">${dataCurta(d.em)}</span></li>`)}</div>
          <div class="card ficha-bloco"><h3>Últimas chaves digitadas</h3>
            ${lista(f.tentativas, "Nenhuma ainda.", t => `<li><span>${esc(t.texto || "—")} ${t.ovo
              ? `<span class="selo-estado sim">abriu o #${String(t.ovo).padStart(2, "0")}</span>`
              : `<span class="selo-estado nao">errada</span>`}</span><span class="fraco">${dataCurta(t.em)}</span></li>`)}</div>
        </div>
      </div>`,
    ligar() {
      document.getElementById("b-debugger").onclick = e => executar(e.currentTarget,
        () => chamar("admin_marcar_debugger", { p_id: id, p_valor: !p.debugger }),
        p.debugger ? `${p.nome} não é mais debugger.` : `${p.nome} agora é debugger.`);
      comConfirmacao(document.getElementById("b-zerar"), "Confirmar: zerar pistas",
        () => executar(null, () => chamar("admin_zerar_pistas", { p_id: id }), "Pistas vistas e enigmas zerados."));
      comConfirmacao(document.getElementById("b-tirar-todos"), `Confirmar: tirar ${plural(achados, "ovo", "ovos")}`,
        () => executar(null, () => chamar("admin_tirar_todos_ovos", { p_id: id }), n => `${plural(n, "ovo tirado", "ovos tirados")}.`));
      document.getElementById("f-nome").onsubmit = e => {
        e.preventDefault();
        executar(e.submitter, () => chamar("admin_renomear", { p_id: id, p_nome: document.getElementById("novo-nome").value }), "Nome trocado.");
      };
      document.querySelectorAll("[data-dar]").forEach(b => b.onclick = () => executar(b,
        () => chamar("admin_dar_ovo", { p_id: id, p_numero: +b.dataset.dar }),
        r => r === "ja_tinha" ? "O jogador já tinha esse ovo." : `Ovo #${String(b.dataset.dar).padStart(2, "0")} dado para ${p.nome}.`));
      document.querySelectorAll("[data-tirar]").forEach(b => comConfirmacao(b, "Confirmar",
        () => executar(null, () => chamar("admin_tirar_ovo", { p_id: id, p_numero: +b.dataset.tirar }),
          `Ovo #${String(b.dataset.tirar).padStart(2, "0")} tirado de ${p.nome}.`)));
    }
  };
}

// =====================================================================
//  OVOS
// =====================================================================
async function telaOvos() {
  const [lista] = await Promise.all([chamar("admin_ovos"), carregarCores()]);
  const links = await linksTemporarios("ovos", lista.filter(o => o.imagem).map(o => o.imagem));
  return {
    html: `
      <div class="admin-topo"><h2>Ovos</h2><a class="btn btn-compacto" href="#ovo/novo">Novo ovo</a></div>
      <div class="admin-tabela-caixa"><table class="admin-tabela">
        <thead><tr><th></th><th>#</th><th>Nome</th><th>Categorias</th><th class="num">Achados</th><th></th></tr></thead>
        <tbody>${lista.length ? lista.map(o => `
          <tr>
            <td>${links[o.imagem] ? `<img class="mini" src="${esc(links[o.imagem])}" alt="">` : ""}</td>
            <td class="fraco">${num(o)}</td>
            <td>${textoRico(o.nome)}</td>
            <td>${etiquetas(o) || `<span class="fraco">—</span>`}</td>
            <td class="num">${o.achados}</td>
            <td class="acoes"><a class="bt" href="#ovo/${o.numero}">Editar</a></td>
          </tr>`).join("") : `<tr><td colspan="6" class="vazio">Nenhum ovo cadastrado.</td></tr>`}
        </tbody>
      </table></div>
      <p class="sub" style="margin-top:10px">"Achados" não conta as contas debugger.</p>`
  };
}

async function telaOvo(id) {
  const [lista] = await Promise.all([chamar("admin_ovos"), carregarCores()]);
  const novo = id === "novo";
  const o = novo
    ? { numero: lista.reduce((m, x) => Math.max(m, x.numero), 0) + 1, nome: "", descricao: "", imagem: "", categorias: [] }
    : lista.find(x => x.numero === Number(id));
  if (!o) throw new Error("Ovo não encontrado.");
  const todasCategorias = [...coresCat.values()].map(c => c.nome).join(", ");
  return {
    html: `
      <a class="admin-voltar" href="#ovos">← Ovos</a>
      <div class="admin-topo"><h2>${novo ? "Novo ovo" : `Editar ovo ${num(o)}`}</h2></div>
      <div class="form-com-previa">
        <form class="card admin-form" id="f-ovo">
          <div class="duas">
            <div><label for="o-numero">Número</label>
              <input id="o-numero" type="number" min="1" value="${o.numero}" ${novo ? "" : "readonly"} required></div>
            <div><label for="o-nome">Nome</label><input id="o-nome" value="${esc(o.nome)}" required></div>
          </div>
          <label for="o-desc">Descrição</label>
          <textarea id="o-desc">${esc(o.descricao)}</textarea>
          <p class="dica">Aceita os efeitos de texto, como [[aura:palavra]].</p>
          <label for="o-imagem">Imagem</label>
          <input id="o-imagem" value="${esc(o.imagem || "")}" placeholder="ovo-nome.png">
          <p class="dica">Nome do arquivo em Storage → ovos (envie a imagem pelo painel do Supabase).</p>
          <label for="o-cats">Categorias</label>
          <input id="o-cats" value="${esc((o.categorias || []).join(", "))}" placeholder="natal, praia">
          <p class="dica">Separadas por vírgula.${todasCategorias ? ` Existentes: ${esc(todasCategorias)}.` : ""}</p>
          <label for="o-chave">${novo ? "Chave" : "Nova chave"}</label>
          <input id="o-chave" autocomplete="off" spellcheck="false" ${novo ? "required" : ""} placeholder="${novo ? "a chave que abre este ovo" : "deixe vazio para manter a chave atual"}">
          <p class="dica">A chave fica embaralhada no banco: a atual nunca aparece aqui, só dá para trocar.</p>
          <button class="btn" id="o-salvar">${novo ? "Criar ovo" : "Salvar ovo"}</button>
        </form>
        <div class="previa"><p class="rotulo">Como aparece para quem achou</p><div id="previa-ovo"></div></div>
      </div>`,
    ligar() {
      const v = id => document.getElementById(id).value;
      const categorias = () => v("o-cats").split(",").map(s => s.trim()).filter(Boolean);
      let imagemUrl = null, imagemDe = null, tempo;
      const desenhar = () => {
        const p = { numero: Number(v("o-numero")) || 0, nome: v("o-nome") || "Nome do ovo", descricao: v("o-desc"),
                    categorias: categorias(), encontrado_em: new Date().toISOString(), imagemUrl };
        document.getElementById("previa-ovo").innerHTML = `
          <div class="card detalhe"><div class="center">${figura(p, true)}
            <h2 style="margin-bottom:2px">${textoRico(p.nome)}</h2><p class="sub" style="margin-bottom:0">${num(p)}</p>${etiquetas(p)}</div>
            <p class="desc">${textoRico(p.descricao)}</p></div>`;
      };
      const buscarImagem = async () => {
        const nome = v("o-imagem").trim();
        if (nome === imagemDe) return;
        imagemDe = nome;
        imagemUrl = nome ? (await linksTemporarios("ovos", [nome]))[nome] || null : null;
        desenhar();
      };
      document.getElementById("f-ovo").oninput = e => {
        if (e.target.id === "o-imagem") { clearTimeout(tempo); tempo = setTimeout(buscarImagem, 500); }
        desenhar();
      };
      buscarImagem();
      document.getElementById("f-ovo").onsubmit = async e => {
        e.preventDefault();
        const botao = document.getElementById("o-salvar");
        botao.disabled = true;
        try {
          const r = await chamar("admin_salvar_ovo", { p_numero: Number(v("o-numero")), p_nome: v("o-nome"), p_descricao: v("o-desc"),
            p_imagem: v("o-imagem"), p_categorias: categorias(), p_chave: v("o-chave") || null });
          avisar(r === "criado" ? "Ovo criado." : "Ovo salvo.");
          location.hash = "#ovos";
        } catch (err) { avisar(traduzErro(err), "err"); botao.disabled = false; }
      };
    }
  };
}

// =====================================================================
//  PISTAS
// =====================================================================
function estadoPista(p) {
  if (!p.visivel) return `<span class="selo-estado nao">Oculta</span>`;
  if (new Date(p.publicada_em) > new Date()) return `<span class="selo-estado aviso">Agendada · ${dataCurta(p.publicada_em)}</span>`;
  return `<span class="selo-estado sim">Publicada</span>`;
}

async function telaPistas() {
  const lista = await chamar("admin_pistas");
  return {
    html: `
      <div class="admin-topo"><h2>Pistas</h2><a class="btn btn-compacto" href="#pista/nova">Nova pista</a></div>
      <div class="admin-tabela-caixa"><table class="admin-tabela">
        <thead><tr><th>Título</th><th>Dificuldade</th><th>Situação</th><th>Enigma</th><th class="num">Vistas</th><th class="num">Resolvidas</th><th></th></tr></thead>
        <tbody>${lista.length ? lista.map(p => `
          <tr>
            <td>${textoRico(p.titulo)}</td>
            <td>${dificuldadePista(p) || `<span class="fraco">—</span>`}</td>
            <td>${estadoPista(p)}</td>
            <td class="fraco">${NOMES_ENIGMA_ADMIN[p.enigma_tipo] || "—"}</td>
            <td class="num">${p.vistas}</td>
            <td class="num">${p.enigma_tipo ? p.resolvidas : "—"}</td>
            <td class="acoes"><a class="bt" href="#pista/${p.id}">Editar</a></td>
          </tr>`).join("") : `<tr><td colspan="7" class="vazio">Nenhuma pista ainda.</td></tr>`}
        </tbody>
      </table></div>
      <p class="sub" style="margin-top:10px">"Vistas" e "Resolvidas" não contam as contas debugger.</p>`
  };
}

// Campos do enigma, que mudam conforme o tipo
function camposEnigma(tipo, cfg) {
  if (tipo === "cadeado_numeros") return `
    <label for="e-digitos">Quantos números (rodinhas)</label>
    <input id="e-digitos" type="number" min="1" max="8" value="${esc(cfg.digitos || 4)}">`;
  if (tipo === "cadeado_simbolos") return `
    <div class="duas">
      <div><label for="e-posicoes">Quantas rodinhas</label><input id="e-posicoes" type="number" min="1" max="8" value="${esc(cfg.posicoes || 3)}"></div>
      <div><label for="e-simbolos">Símbolos que aparecem</label><input id="e-simbolos" value="${esc((cfg.simbolos || []).join(" "))}" placeholder="sol lua estrela ovo"></div>
    </div>
    <p class="dica">Separados por espaço. Vale: ${SIMBOLOS_NOMES.join(", ")}. Vazio = todos. A resposta usa os mesmos nomes, ex.: sol lua ovo.</p>`;
  if (tipo === "cifra") return `
    <label for="e-mensagem">Mensagem cifrada (como o jogador vê)</label>
    <textarea id="e-mensagem" style="min-height:70px">${esc(cfg.mensagem || "")}</textarea>
    <div class="duas">
      <div><label for="e-original">Cifrar um texto</label><input id="e-original" placeholder="a resposta e fenix"></div>
      <div><label for="e-casas">Casas que cada letra anda</label><input id="e-casas" type="number" min="1" max="25" value="3"></div>
    </div>
    <p class="dica"><button type="button" class="bt" id="e-cifrar">Cifrar e colocar na mensagem</button></p>`;
  return "";
}

function configEnigma(tipo) {
  const v = id => (document.getElementById(id) || {}).value || "";
  if (tipo === "cadeado_numeros") return { digitos: Number(v("e-digitos")) || 4 };
  if (tipo === "cadeado_simbolos") {
    const simbolos = v("e-simbolos").split(/\s+/).map(s => norm(s)).filter(Boolean);
    return { posicoes: Number(v("e-posicoes")) || 3, ...(simbolos.length ? { simbolos } : {}) };
  }
  if (tipo === "cifra") return { mensagem: v("e-mensagem") };
  return {};
}

async function telaPista(id) {
  const nova = id === "nova";
  let p;
  if (nova) {
    p = { titulo: "", descricao: "", texto: "", imagens: [], video: "", audio: "", link: "", link_texto: "",
          publicada_em: new Date().toISOString(), visivel: true, dificuldade: "", enigma_tipo: "", enigma_config: {},
          recompensa_texto: "", recompensa_imagem: "", tem_resposta: false };
  } else {
    p = (await chamar("admin_pistas")).find(x => String(x.id) === String(id));
    if (!p) throw new Error("Pista não encontrada.");
  }
  const opcao = (valor, nome, atual) => `<option value="${valor}" ${valor === (atual || "") ? "selected" : ""}>${nome}</option>`;
  return {
    html: `
      <a class="admin-voltar" href="#pistas">← Pistas</a>
      <div class="admin-topo"><h2>${nova ? "Nova pista" : "Editar pista"}</h2></div>
      <div class="form-com-previa">
        <form class="card admin-form" id="f-pista">
          <label for="p-titulo">Título</label><input id="p-titulo" value="${esc(p.titulo)}" required>
          <label for="p-desc">Resumo (aparece na lista)</label><input id="p-desc" value="${esc(p.descricao || "")}">
          <label for="p-texto">Texto completo</label><textarea id="p-texto">${esc(p.texto || "")}</textarea>
          <p class="dica">Aceita os efeitos de texto, como [[segredo:...]] e [[invisivel:...]].</p>
          <div class="duas">
            <div><label for="p-dif">Dificuldade</label>
              <select id="p-dif">${opcao("", "Sem dificuldade", p.dificuldade)}${Object.entries(DIFICULDADES).map(([k, n]) => opcao(k, n, p.dificuldade)).join("")}</select></div>
            <div><label for="p-data">Publicar em</label><input id="p-data" type="datetime-local" value="${paraCampoData(p.publicada_em)}"></div>
          </div>
          <p class="dica">Uma data no futuro deixa a pista agendada: só aparece nesse dia e hora.</p>
          <label class="marcar"><input type="checkbox" id="p-visivel" ${p.visivel ? "checked" : ""}> Visível para os jogadores</label>

          <fieldset><legend>Imagens, vídeo, áudio e link</legend>
            <label for="p-imagens">Imagens (uma por linha)</label>
            <textarea id="p-imagens" style="min-height:70px" placeholder="mapa.png">${esc((p.imagens || []).join("\n"))}</textarea>
            <p class="dica">Nome do arquivo em Storage → pistas, ou um endereço https://. A primeira vira a capa.</p>
            <div class="duas">
              <div><label for="p-video">Vídeo</label><input id="p-video" value="${esc(p.video || "")}" placeholder="link do YouTube ou arquivo"></div>
              <div><label for="p-audio">Áudio</label><input id="p-audio" value="${esc(p.audio || "")}" placeholder="arquivo ou https://"></div>
              <div><label for="p-link">Link</label><input id="p-link" value="${esc(p.link || "")}" placeholder="https://..."></div>
              <div><label for="p-link-texto">Texto do link</label><input id="p-link-texto" value="${esc(p.link_texto || "")}"></div>
            </div>
          </fieldset>

          <fieldset><legend>Enigma</legend>
            <label for="p-enigma">Tipo</label>
            <select id="p-enigma">${opcao("", "Sem enigma", p.enigma_tipo)}${Object.entries(NOMES_ENIGMA_ADMIN).map(([k, n]) => opcao(k, n, p.enigma_tipo)).join("")}</select>
            <div id="campos-enigma">${camposEnigma(p.enigma_tipo, p.enigma_config || {})}</div>
            <div id="bloco-resposta" ${p.enigma_tipo ? "" : "hidden"}>
              <label for="p-resposta">${p.tem_resposta ? "Nova resposta" : "Resposta"}</label>
              <input id="p-resposta" autocomplete="off" spellcheck="false" placeholder="${p.tem_resposta ? "deixe vazio para manter a resposta atual" : "a resposta certa"}">
              <p class="dica">A resposta fica embaralhada no banco: a atual nunca aparece aqui. Maiúsculas e acentos não importam.</p>
              <label for="p-recompensa">Recompensa (aparece ao acertar)</label>
              <textarea id="p-recompensa" style="min-height:70px">${esc(p.recompensa_texto || "")}</textarea>
              <label for="p-recompensa-img">Imagem da recompensa</label>
              <input id="p-recompensa-img" value="${esc(p.recompensa_imagem || "")}" placeholder="arquivo em Storage → recompensas, ou https://">
            </div>
          </fieldset>
          <button class="btn" id="p-salvar">${nova ? "Criar pista" : "Salvar pista"}</button>
        </form>
        <div class="previa"><p class="rotulo">Como aparece na lista e aberta</p><div id="previa-pista"></div></div>
      </div>`,
    ligar() {
      const v = id => document.getElementById(id).value;
      const tipo = () => v("p-enigma");
      const desenhar = () => {
        const q = { titulo: v("p-titulo") || "Título da pista", descricao: v("p-desc"), texto: v("p-texto"),
                    dificuldade: v("p-dif"), publicada_em: v("p-data") ? new Date(v("p-data")).toISOString() : new Date().toISOString() };
        document.getElementById("previa-pista").innerHTML = `
          <div class="pista" style="margin-bottom:14px"><div class="pista-texto">
            <div class="pista-meta">${metaPista(q)}</div>${dificuldadePista(q)}
            <div class="pista-titulo">${textoRico(q.titulo)}</div>
            ${q.descricao ? `<div class="pista-desc">${textoRico(q.descricao)}</div>` : ""}</div></div>
          <article class="card pista-det" style="padding:18px">
            <h2>${textoRico(q.titulo)}</h2>
            ${q.descricao ? `<p class="pista-lead">${textoRico(q.descricao)}</p>` : ""}
            ${q.texto ? `<p class="desc">${textoRico(q.texto)}</p>` : ""}
            ${tipo() ? `<div class="enigma"><div class="enigma-titulo">🧩 ${NOMES_ENIGMA_ADMIN[tipo()]}</div></div>` : ""}
          </article>`;
      };
      const ligarCifra = () => {
        const b = document.getElementById("e-cifrar");
        if (b) b.onclick = () => {
          document.getElementById("e-mensagem").value = cesarAdmin(v("e-original"), Number(v("e-casas")) || 3);
        };
      };
      document.getElementById("p-enigma").onchange = () => {
        document.getElementById("campos-enigma").innerHTML = camposEnigma(tipo(), {});
        document.getElementById("bloco-resposta").hidden = !tipo();
        ligarCifra();
        desenhar();
      };
      ligarCifra();
      document.getElementById("f-pista").oninput = desenhar;
      desenhar();
      document.getElementById("f-pista").onsubmit = async e => {
        e.preventDefault();
        const botao = document.getElementById("p-salvar");
        botao.disabled = true;
        try {
          const dados = {
            id: nova ? null : p.id, titulo: v("p-titulo"), descricao: v("p-desc"), texto: v("p-texto"),
            imagens: v("p-imagens").split("\n").map(s => s.trim()).filter(Boolean),
            video: v("p-video").trim(), audio: v("p-audio").trim(), link: v("p-link").trim(), link_texto: v("p-link-texto"),
            publicada_em: v("p-data") ? new Date(v("p-data")).toISOString() : null,
            visivel: document.getElementById("p-visivel").checked, dificuldade: v("p-dif"),
            enigma_tipo: tipo(), enigma_config: configEnigma(tipo()),
            resposta: tipo() ? v("p-resposta") : "", recompensa_texto: tipo() ? v("p-recompensa") : "",
            recompensa_imagem: tipo() ? v("p-recompensa-img").trim() : "",
          };
          await chamar("admin_salvar_pista", { p: dados });
          avisar(nova ? "Pista criada." : "Pista salva.");
          location.hash = "#pistas";
        } catch (err) { avisar(traduzErro(err), "err"); botao.disabled = false; }
      };
    }
  };
}

// =====================================================================
//  DESAFIOS
// =====================================================================
async function telaDesafios() {
  const lista = await chamar("admin_desafios");
  return {
    html: `
      <div class="admin-topo"><h2>Desafios</h2></div>
      <div class="admin-tabela-caixa"><table class="admin-tabela">
        <thead><tr><th>Desafio</th><th>Página</th><th>Situação</th><th class="num">Completaram</th><th></th></tr></thead>
        <tbody>${lista.length ? lista.map(d => `
          <tr>
            <td>${esc(d.titulo)}</td>
            <td><a class="fraco" href="/${encodeURIComponent(d.slug)}/" target="_blank" rel="noopener">/${esc(d.slug)}/</a></td>
            <td>${d.ativo ? `<span class="selo-estado sim">Ativo</span>` : `<span class="selo-estado aviso">Só debugger</span>`}</td>
            <td class="num">${d.resolvidos}</td>
            <td class="acoes">
              <button class="bt ${d.ativo ? "perigo" : "ouro"}" data-alternar="${esc(d.slug)}">${d.ativo ? "Desativar" : "Ativar"}</button>
              <a class="bt" href="#desafio/${encodeURIComponent(d.slug)}">Editar</a>
            </td>
          </tr>`).join("") : `<tr><td colspan="5" class="vazio">Nenhum desafio cadastrado.</td></tr>`}
        </tbody>
      </table></div>
      <p class="sub" style="margin-top:10px">Desafio desativado: só as contas debugger conseguem completar. "Completaram" não conta as contas debugger.</p>`,
    ligar() {
      document.querySelectorAll("[data-alternar]").forEach(b => {
        const d = lista.find(x => x.slug === b.dataset.alternar);
        const alternar = () => executar(b, () => chamar("admin_salvar_desafio", { p_slug: d.slug, p_titulo: d.titulo, p_ativo: !d.ativo,
          p_recompensa_texto: d.recompensa_texto, p_recompensa_imagem: d.recompensa_imagem, p_resposta: null }),
          d.ativo ? `"${d.titulo}" desativado.` : `"${d.titulo}" ativado para todos.`);
        if (d.ativo) comConfirmacao(b, "Confirmar", alternar); else b.onclick = alternar;
      });
    }
  };
}

async function telaDesafio(slug) {
  const d = (await chamar("admin_desafios")).find(x => x.slug === slug);
  if (!d) throw new Error("Desafio não encontrado.");
  return {
    html: `
      <a class="admin-voltar" href="#desafios">← Desafios</a>
      <div class="admin-topo"><h2>Editar desafio</h2><span class="sub" style="margin:0">/${esc(d.slug)}/</span></div>
      <form class="card admin-form estreito" id="f-desafio" style="max-width:640px">
        <label for="d-titulo">Título</label><input id="d-titulo" value="${esc(d.titulo)}" required>
        <label class="marcar"><input type="checkbox" id="d-ativo" ${d.ativo ? "checked" : ""}> Ativo para todos os jogadores</label>
        <label for="d-recompensa">Recompensa (aparece ao completar)</label>
        <textarea id="d-recompensa">${esc(d.recompensa_texto || "")}</textarea>
        <label for="d-recompensa-img">Imagem da recompensa</label>
        <input id="d-recompensa-img" value="${esc(d.recompensa_imagem || "")}" placeholder="arquivo em Storage → recompensas, ou https://">
        <label for="d-resposta">Nova resposta</label>
        <input id="d-resposta" autocomplete="off" spellcheck="false" placeholder="deixe vazio para manter a resposta atual">
        <p class="dica">Cuidado: em alguns desafios a resposta é um código que a própria página cria. Só troque se souber qual é.</p>
        <button class="btn" id="d-salvar">Salvar desafio</button>
      </form>`,
    ligar() {
      const v = id => document.getElementById(id).value;
      document.getElementById("f-desafio").onsubmit = async e => {
        e.preventDefault();
        const botao = document.getElementById("d-salvar");
        botao.disabled = true;
        try {
          await chamar("admin_salvar_desafio", { p_slug: d.slug, p_titulo: v("d-titulo"), p_ativo: document.getElementById("d-ativo").checked,
            p_recompensa_texto: v("d-recompensa"), p_recompensa_imagem: v("d-recompensa-img"), p_resposta: v("d-resposta") || null });
          avisar("Desafio salvo.");
          location.hash = "#desafios";
        } catch (err) { avisar(traduzErro(err), "err"); botao.disabled = false; }
      };
    }
  };
}

// =====================================================================
//  CATEGORIAS
// =====================================================================
async function telaCategorias() {
  const lista = await chamar("admin_categorias");
  coresCat = new Map(lista.map(c => [norm(c.nome), c]));   // para desenhar as etiquetas
  const brilhos = (atual) => ["", "aura", "reflexo", "estrelas"]
    .map(b => `<option value="${b}" ${b === (atual || "") ? "selected" : ""}>${b ? rotulo(b) : "Nenhum"}</option>`).join("");
  const linha = (c, nova) => `
    <tr data-categoria="${esc(c.nome)}">
      <td class="etq">${nova ? "" : etiqueta(c.nome)}</td>
      <td>${nova ? `<input class="c-nome" placeholder="nome da categoria" aria-label="Nome da nova categoria">` : esc(c.nome)}</td>
      <td><input type="color" class="c-cor" value="${esc(c.cor || "#8a7f70")}" aria-label="Cor"></td>
      <td><input class="c-icone campo-icone" value="${esc(c.icone || "")}" ${nova ? `placeholder="ex.: 🎄"` : ""} aria-label="Ícone"></td>
      <td><select class="c-brilho" aria-label="Brilho">${brilhos(c.brilho)}</select></td>
      <td class="num">${nova ? "" : c.ovos}</td>
      <td class="acoes"><button class="bt ouro c-salvar">${nova ? "Criar" : "Salvar"}</button></td>
    </tr>`;
  return {
    html: `
      <div class="admin-topo"><h2>Categorias</h2></div>
      <div class="admin-tabela-caixa"><table class="admin-tabela">
        <thead><tr><th>Etiqueta</th><th>Nome</th><th>Cor</th><th>Ícone</th><th>Brilho</th><th class="num">Ovos</th><th></th></tr></thead>
        <tbody>${lista.map(c => linha(c, false)).join("")}${linha({ nome: "", cor: "#8a7f70" }, true)}</tbody>
      </table></div>
      <p class="sub" style="margin-top:10px">A etiqueta muda na hora; ela só vale no site depois de salvar. A última linha cria uma categoria nova.</p>`,
    ligar() {
      document.querySelectorAll("tr[data-categoria]").forEach(tr => {
        const pega = c => tr.querySelector(c);
        const nome = () => tr.dataset.categoria || pega(".c-nome").value.trim();
        const previa = () => {
          if (!nome()) return;
          coresCat.set(norm(nome()), { nome: nome(), cor: pega(".c-cor").value, icone: pega(".c-icone").value.trim(), brilho: pega(".c-brilho").value });
          pega(".etq").innerHTML = etiqueta(nome());
        };
        tr.oninput = previa;
        tr.onchange = previa;
        pega(".c-salvar").onclick = e => executar(e.currentTarget, () => chamar("admin_salvar_categoria", {
          p_nome: nome(), p_cor: pega(".c-cor").value, p_icone: pega(".c-icone").value, p_brilho: pega(".c-brilho").value }),
          `Categoria "${nome()}" salva.`);
      });
    }
  };
}

// =====================================================================
//  ESTATÍSTICAS
// =====================================================================
async function telaEstatisticas() {
  const e = await chamar("admin_estatisticas");
  const tabela = (cabeca, linhas, vazio) => `
    <div class="admin-tabela-caixa"><table class="admin-tabela"><thead><tr>${cabeca}</tr></thead>
      <tbody>${linhas || `<tr><td colspan="9" class="vazio">${vazio}</td></tr>`}</tbody></table></div>`;
  const diaCurto = d => new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  return {
    html: `
      <div class="admin-topo"><h2>Estatísticas</h2><span class="sub" style="margin:0">Sem as contas debugger</span></div>
      <div class="numeros">
        <div class="numero-caixa"><b>${e.jogadores}</b><span>jogadores</span></div>
        <div class="numero-caixa"><b>${e.novos_7_dias}</b><span>novos nos últimos 7 dias</span></div>
        <div class="numero-caixa"><b>${e.ovos_encontrados}</b><span>ovos encontrados no total</span></div>
        <div class="numero-caixa"><b>${e.com_algum_ovo}</b><span>jogadores com pelo menos 1 ovo</span></div>
      </div>
      <div class="estat-grade">
        <div class="ficha-bloco"><h3>Cada ovo</h3>
          ${tabela(`<th>#</th><th>Ovo</th><th class="num">Acharam</th><th class="num">% dos jogadores</th>`,
            e.por_ovo.map(o => `<tr><td class="fraco">${num(o)}</td><td>${textoRico(o.nome)}</td><td class="num">${o.achados}</td><td class="num">${o.porcento}%</td></tr>`).join(""),
            "Nenhum ovo cadastrado.")}</div>
        <div class="ficha-bloco"><h3>Últimos 14 dias</h3>
          ${tabela(`<th>Dia</th><th class="num">Cadastros</th><th class="num">Ovos achados</th>`,
            [...e.por_dia].reverse().map(d => `<tr><td>${diaCurto(d.dia)}</td><td class="num">${d.cadastros}</td><td class="num">${d.ovos}</td></tr>`).join(""), "")}</div>
        <div class="ficha-bloco"><h3>Chaves erradas mais tentadas</h3>
          <p class="sub" style="margin:-4px 0 10px">Últimos 60 dias. Mostra onde os jogadores estão travando ou chegando perto.</p>
          ${tabela(`<th>Chave digitada</th><th class="num">Vezes</th><th class="num">Pessoas</th>`,
            e.chaves_erradas.map(c => `<tr><td>${esc(c.texto)}</td><td class="num">${c.vezes}</td><td class="num">${c.pessoas}</td></tr>`).join(""),
            "Nenhuma chave errada ainda.")}</div>
        <div class="ficha-bloco"><h3>Respostas erradas nos enigmas</h3>
          <p class="sub" style="margin:-4px 0 10px">Últimos 60 dias.</p>
          ${tabela(`<th>Pista</th><th>Resposta</th><th class="num">Vezes</th>`,
            e.enigmas_errados.map(c => `<tr><td>${textoRico(c.pista)}</td><td>${esc(c.texto)}</td><td class="num">${c.vezes}</td></tr>`).join(""),
            "Nenhuma resposta errada ainda.")}</div>
      </div>
      <div class="ficha-bloco"><h3>Últimos ovos encontrados</h3>
        ${tabela(`<th>Quando</th><th>Quem</th><th>Ovo</th>`,
          e.atividade.map(a => `<tr><td class="fraco">${dataCurta(a.em)}</td><td>${esc(a.quem)}${a.debugger ? `<span class="selo-debugger">debugger</span>` : ""}</td>
            <td>${num({ numero: a.ovo })} ${textoRico(a.ovo_nome)}</td></tr>`).join(""),
          "Ninguém achou ovos ainda.")}</div>`
  };
}

// =====================================================================
//  REGISTRO
// =====================================================================
function descreverAcao(acao, d) {
  const ovo = n => `#${String(n).padStart(2, "0")}`;
  const quem = esc(d.jogador || "");
  switch (acao) {
    case "dar_ovo":            return `Deu o ovo ${ovo(d.ovo)} para ${quem}`;
    case "tirar_ovo":          return `Tirou o ovo ${ovo(d.ovo)} de ${quem}`;
    case "tirar_todos_ovos":   return `Tirou todos os ovos de ${quem} (${plural(d.quantos, "ovo", "ovos")})`;
    case "marcar_debugger":    return `Marcou ${quem} como debugger`;
    case "desmarcar_debugger": return `Tirou a marca debugger de ${quem}`;
    case "zerar_pistas":       return `Zerou as pistas vistas e os enigmas de ${quem}`;
    case "renomear":           return `Trocou o nome "${esc(d.antes)}" para "${esc(d.depois)}"`;
    case "criar_ovo":          return `Criou o ovo ${ovo(d.ovo)} (${esc(d.nome)})`;
    case "editar_ovo":         return `Editou o ovo ${ovo(d.ovo)} (${esc(d.nome)})${d.trocou_chave ? " e trocou a chave" : ""}`;
    case "criar_pista":        return `Criou a pista "${esc(d.titulo)}"`;
    case "editar_pista":       return `Editou a pista "${esc(d.titulo)}"${d.trocou_resposta ? " e trocou a resposta" : ""}`;
    case "editar_desafio":     return `Editou o desafio /${esc(d.desafio)}/`
                                 + (d.ativo_antes !== d.ativo_depois ? (d.ativo_depois ? " e ativou" : " e desativou") : "")
                                 + (d.trocou_resposta ? " e trocou a resposta" : "");
    case "salvar_categoria":   return `Salvou a categoria "${esc(d.categoria)}"`;
    default:                   return `${esc(acao)} ${esc(JSON.stringify(d))}`;
  }
}

async function telaRegistro() {
  const lista = await chamar("admin_registro_lista", { p_limite: 200 });
  return {
    html: `
      <div class="admin-topo"><h2>Registro</h2><span class="sub" style="margin:0">Tudo o que os administradores fizeram (últimas 200 ações)</span></div>
      <div class="admin-tabela-caixa"><table class="admin-tabela">
        <thead><tr><th>Quando</th><th>Quem</th><th>O que fez</th></tr></thead>
        <tbody>${lista.length ? lista.map(r => `
          <tr><td class="fraco">${dataCurta(r.quando)}</td><td>${esc(r.admin_nome || "—")}</td><td>${descreverAcao(r.acao, r.detalhes || {})}</td></tr>`).join("")
          : `<tr><td colspan="3" class="vazio">Nenhuma ação registrada ainda.</td></tr>`}
        </tbody>
      </table></div>`
  };
}

// =====================================================================
//  Montagem da página
// =====================================================================
const TELAS = {
  jogadores: telaJogadores, jogador: telaJogador, ovos: telaOvos, ovo: telaOvo, pistas: telaPistas, pista: telaPista,
  desafios: telaDesafios, desafio: telaDesafio, categorias: telaCategorias, estatisticas: telaEstatisticas, registro: telaRegistro,
};

let vezRender = 0;
async function render() {
  const { secao, id } = rota();
  const tela = TELAS[secao] ? secao : "jogadores";
  const doMenu = SECAO_DE[tela] || tela;
  document.querySelectorAll(".admin-menu a").forEach(a => {
    if (a.dataset.secao === doMenu) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  const alvo = document.getElementById("admin-conteudo");
  const vez = ++vezRender;
  if (!alvo.innerHTML.trim()) alvo.innerHTML = `<p class="sub">Carregando…</p>`;
  try {
    const t = await TELAS[tela](id);
    if (vez !== vezRender) return;   // a pessoa já foi para outra seção
    alvo.innerHTML = t.html;
    if (t.ligar) t.ligar();
  } catch (err) {
    if (vez !== vezRender) return;
    const semPermissao = err && (err.code === "42501" || /debugger/i.test(err.message || ""));
    alvo.innerHTML = `<div class="card"><p class="msg err" style="margin:0">${esc(semPermissao ? "Esta área é só para contas debugger." : traduzErro(err))}</p></div>`;
  }
}

iniciarPagina().then(ok => {
  if (!ok) return;
  if (!souDebugger) {
    app.innerHTML = `<div class="card center estreito"><h2>Área restrita</h2><p class="sub" style="margin:0">Esta área é só para contas debugger.</p></div>`;
    return;
  }
  app.innerHTML = `
    <div class="admin">
      <nav class="admin-menu" aria-label="Seções da administração">
        ${SECOES.map(s => `<a href="#${s.id}" data-secao="${s.id}">${s.nome}</a>`).join("")}
      </nav>
      <div class="admin-aviso" id="admin-aviso" aria-live="polite"></div>
      <section id="admin-conteudo"></section>
    </div>`;
  addEventListener("hashchange", () => { window.scrollTo(0, 0); render(); });
  render();
});
