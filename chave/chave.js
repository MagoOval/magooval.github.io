// Página Chave: o jogador digita a chave e invoca um ovo.
function telaChave() {
  app.innerHTML = `
    <form class="feitico estreito" id="f" autocomplete="off">
      <div class="tabuleta-sombra">
        <div class="tabuleta">
          <h2 class="feitico-titulo">CHAVE</h2>
          ${SIGILO}
          <p class="feitico-instrucao">Invoque um ovo<br>digitando sua chave:</p>
        </div>
      </div>
      <div class="card caixa-senha">
        <input id="s" required spellcheck="false" autocomplete="off" aria-label="Chave do ovo" placeholder="Chave aqui">
        <button class="btn btn-compacto" id="go">Invocar</button>
      </div>
      <div class="msg" id="m" role="status"></div>
    </form>`;
  const f = document.getElementById("f"), s = document.getElementById("s");
  const sig = document.getElementById("sigilo"), m = document.getElementById("m"), go = document.getElementById("go");
  s.focus({ preventScroll: true });   // cursor no campo, sem rolar a tela para baixo
  let apagar;
  // o selo acende a cada letra digitada
  s.oninput = () => {
    soltarFaisca(f, s);
    sig.classList.add("ativo");
    clearTimeout(apagar);
    apagar = setTimeout(() => sig.classList.remove("ativo"), 350);
  };
  f.onsubmit = async e => {
    e.preventDefault();
    go.disabled = true; m.className = "msg"; m.textContent = "Conjurando…";
    sig.classList.remove("falhou", "sucesso", "ativo");
    void sig.getBoundingClientRect();
    sig.classList.add("conjurando");
    for (let i = 0; i < 8; i++) setTimeout(() => soltarFaisca(f, s), i * 60);
    try {
      const [{ data, error }] = await Promise.all([sb.rpc("resgatar_ovo", { p_senha: s.value }), esperar(900)]);
      sig.classList.remove("conjurando");
      if (error) throw error;
      if (data.status === "novo") {
        sig.classList.add("sucesso");
        m.className = "msg ok";
        m.textContent = data.zumbi ? "🧟 Você foi infectado… e um ovo surgiu!" : "O feitiço funcionou! Um ovo surgiu…";
        await esperar(900);
        return location.assign(`/ovos/?n=${data.numero}&novo=1`);
      }
      if (data.status === "portal") {
        m.className = "msg"; m.textContent = "";   // nada de aviso: o rasgo é surpresa
        go.disabled = false;
        return abrirPortal(data.url);
      }
      if (data.status === "repetido") {
        m.textContent = "Este ovo já atendeu ao seu chamado antes.";
      } else if (data.status === "aguarde") {
        m.className = "msg err"; m.textContent = "A magia precisa descansar. Espere um minuto.";
      } else if (data.status === "zumbi_propria") {
        m.textContent = "🧟 Essa é a sua própria chave de contágio. Passe para outra pessoa!";
      } else if (data.status === "zumbi_esgotada") {
        m.className = "msg err"; m.textContent = `🧟 Essa chave já infectou ${data.usos_max || 5} pessoas… e morreu.`;
      } else {
        void sig.getBoundingClientRect();
        sig.classList.add("falhou");
        setTimeout(() => sig.classList.remove("falhou"), 1400);
        m.className = "msg err"; m.textContent = "O feitiço falhou… nenhum ovo responde a essa chave.";
      }
    } catch (err) {
      sig.classList.remove("conjurando");
      m.className = "msg err"; m.textContent = traduzErro(err);
    }
    go.disabled = false;
    s.select();
  };
}

// ---- Portal: senha que leva para outro site ----
// Uma fenda vertical de bordas vermelhas brilhantes rasga a tela aos trancos, solta rachaduras
// para os lados e vai alargando até engolir tudo; com a tela preta, o site abre na mesma aba.
function abrirPortal(endereco) {
  let destino;
  try { destino = new URL(endereco, location.href); } catch { return; }
  if (!/^https?:$/.test(destino.protocol)) return;
  let foi = false;
  const ir = () => { if (!foi) { foi = true; location.assign(destino.href); } };

  const fundo = document.createElement("div");
  fundo.className = "rasgo";
  document.body.append(fundo);
  if (reduzirMovimento()) { fundo.classList.add("preto"); return setTimeout(ir, 1000); }

  const L = innerWidth, A = innerHeight;
  const sorte = (a, b) => a + Math.random() * (b - a);
  const meio = A * sorte(.4, .6);

  // caminho do centro da fenda: ondula um pouco (fixo na tela, para crescer sempre pelo mesmo lugar)
  const f1 = sorte(.004, .008), f2 = sorte(.015, .03), g1 = sorte(0, 6), g2 = sorte(0, 6);
  const centro = y => L / 2 + Math.sin(y * f1 + g1) * L * .05 + Math.sin(y * f2 + g2) * 10;
  // bordas em zigue-zague: um "dente" sorteado a cada 12px de altura
  const linhas = [];
  for (let y = -A; y <= 2 * A; y += 12) linhas.push({ y, e: sorte(0, 1) ** 2 * 16 - 3, d: sorte(0, 1) ** 2 * 16 - 3 });

  // rachaduras que saem das bordas
  const galhos = [];
  for (let i = 0; i < 22; i++) {
    const lado = i % 2 ? 1 : -1, sobe = Math.random() < .5 ? -1 : 1;
    const pts = [[0, 0]];
    let x = 0, y = 0, ang = sorte(10, 65) * Math.PI / 180;
    const comp = sorte(50, i < 8 ? 320 : 160), n = 4 + Math.floor(sorte(0, 5));
    for (let k = 0; k < n; k++) {
      ang = Math.min(1.4, Math.max(0, ang + sorte(-.45, .45)));
      x += Math.cos(ang) * comp / n * lado;
      y += Math.sin(ang) * comp / n * sobe;
      pts.push([x, y]);
    }
    galhos.push({ y0: meio + sorte(-.7, .7) * A, lado, pts, vez: null });
  }

  fundo.innerHTML = `
    <svg class="rasgo-svg" viewBox="0 0 ${L} ${A}" aria-hidden="true">
      <defs>
        <filter id="rasgo-brilho" filterUnits="userSpaceOnUse" x="-60" y="-60" width="${L + 120}" height="${A + 120}">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g class="galhos" filter="url(#rasgo-brilho)"></g>
      <path class="fenda-fundo"/>
      <path class="fenda-brilho" filter="url(#rasgo-brilho)"/>
      <path class="fenda-borda"/>
    </svg>`;
  const grupo = fundo.querySelector(".galhos");
  const caminhos = [".fenda-fundo", ".fenda-brilho", ".fenda-borda"].map(c => fundo.querySelector(c));
  galhos.forEach(g => {
    g.el = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    g.el.setAttribute("class", "galho");
    g.el.setAttribute("pathLength", "1");
    g.el.setAttribute("stroke-dasharray", "0 1");
    g.el.setAttribute("points", g.pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "));
    grupo.append(g.el);
  });

  // [tempo em ms, comprimento (× altura da tela), meia-largura em px, é tranco?]
  const quadros = [
    [0, 0, 0], [600, 0, 0],
    [850, .14, 2.5, 1], [1400, .16, 3],
    [1650, .4, 5, 1], [2250, .42, 6],
    [2500, .8, 9, 1], [3100, .83, 11],
    [3400, 1.5, 17, 1], [4100, 1.6, 21],
    [4350, 1.8, 55, 1], [5000, 1.9, 75],
    [6500, 3.2, L * 1.1],
  ];
  const falha = () => {
    document.body.style.setProperty("--falha", `${sorte(-8, 8).toFixed(0)}px`);
    document.body.classList.add("rasgo-falha"); fundo.classList.add("tranco");
    setTimeout(() => { document.body.classList.remove("rasgo-falha"); fundo.classList.remove("tranco"); }, 170);
  };

  const inicio = performance.now();
  let trecho = -1;
  const quadro = agora => {
    const ms = agora - inicio;
    let i = quadros.findIndex(q => q[0] > ms);
    if (i === -1) i = quadros.length - 1;
    const [t0, c0, l0] = quadros[Math.max(0, i - 1)], [t1, c1, l1, tranco] = quadros[i];
    let t = Math.min(1, Math.max(0, (ms - t0) / (t1 - t0 || 1)));
    t = i === quadros.length - 1 ? t * t * t : tranco ? 1 - (1 - t) ** 3 : t;
    if (i !== trecho) { trecho = i; if (tranco) falha(); }
    const comp = (c0 + (c1 - c0) * t) * A, larg = l0 + (l1 - l0) * t;

    if (comp > 2) {
      const y0 = meio - comp / 2, y1 = meio + comp / 2, esq = [], dir = [];
      const borda = (y, lado, r) => {
        const p = Math.sin(Math.PI * (y - y0) / (y1 - y0)) ** .75, k = Math.min(1, larg * p / 6);
        return centro(y) + lado * (larg * p + (r ? (lado < 0 ? r.e : r.d) * k : 0));
      };
      for (const r of linhas) if (r.y > y0 && r.y < y1) {
        esq.push(`${borda(r.y, -1, r).toFixed(1)},${r.y}`);
        dir.push(`${borda(r.y, 1, r).toFixed(1)},${r.y}`);
      }
      const d = "M" + [`${centro(y0).toFixed(1)},${y0.toFixed(1)}`, ...esq,
                       `${centro(y1).toFixed(1)},${y1.toFixed(1)}`, ...dir.reverse()].join(" L") + " Z";
      caminhos.forEach(c => c.setAttribute("d", d));

      for (const g of galhos) {
        if (g.vez === null && larg > 4 && g.y0 > y0 + comp * .15 && g.y0 < y1 - comp * .15) g.vez = ms;
        if (g.vez === null) continue;
        const f = Math.min(1, (ms - g.vez) / 900);
        g.el.setAttribute("stroke-dasharray", `${(1 - (1 - f) ** 3).toFixed(3)} 1`);
        g.el.setAttribute("transform", `translate(${borda(g.y0, g.lado).toFixed(1)} ${g.y0.toFixed(1)})`);
      }
    }
    if (ms > 6000) fundo.classList.add("preto");
    if (ms < 7200) requestAnimationFrame(quadro); else ir();
  };
  requestAnimationFrame(quadro);
  setTimeout(ir, 9000);   // garantia, se a aba ficar em segundo plano
}
// voltando pelo botão "voltar" do navegador, tira o rasgo da frente
addEventListener("pageshow", e => {
  if (!e.persisted) return;
  document.querySelectorAll(".rasgo").forEach(r => r.remove());
  document.body.classList.remove("rasgo-falha");
});

iniciarPagina().then(ok => { if (ok) telaChave(); });
