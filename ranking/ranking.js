// Página Ranking: o ranking geral.
// ---- Tela: Ranking geral ----
// Quem tem mais ovos fica na frente; no empate, quem chegou primeiro àquela quantidade.
// A ordem e quem aparece (top 10 + a própria linha) vêm do Supabase (ranking_geral).
function telaRanking() {
  app.innerHTML = `
    <div class="ranking-geral estreito">
      <h2>${ic("trofeu")}Ranking</h2>
      <div id="rk-geral"><p class="ranking-msg">Carregando ranking…</p></div>
    </div>`;
  carregarRankingGeral();
}

async function carregarRankingGeral() {
  const alvo = document.getElementById("rk-geral");
  try {
    const { data, error } = await sb.rpc("ranking_geral");
    if (error) throw error;
    if (!document.body.contains(alvo)) return;   // usuário já saiu desta tela
    if (!data || !data.length) { alvo.innerHTML = `<p class="ranking-msg">Ninguém no ranking ainda.</p>`; return; }
    const qtdOvos = n => `<span class="qtd" title="${n} ${n === 1 ? "ovo" : "ovos"}">${ic("ovo")} ${n}</span>`;
    // Pódio: os 3 primeiros lugares (na tela: 2º, 1º, 3º)
    const topo3 = data.filter(r => Number(r.posicao) <= 3).slice(0, 3);
    const degrau = r => {
      const pos = Number(r.posicao);
      return `<div class="degrau p${pos} ${r.sou_eu ? "eu" : ""}">
        ${medalhaDe(pos)}
        <span class="quem" title="${esc(r.nome)}">${esc(r.nome)}${r.sou_eu ? " (você)" : ""}</span>
        ${qtdOvos(Number(r.ovos))}
        <span class="quando">${dataHora(r.conseguido_em)}</span>
        <div class="bloco" aria-hidden="true">${pos}</div>
      </div>`;
    };
    const ordemPodio = [topo3[1], topo3[0], topo3[2]].filter(Boolean);
    const podio = topo3.length ? `<div class="podio" role="list" aria-label="Pódio">${ordemPodio.map(r => `<div role="listitem">${degrau(r)}</div>`).join("")}</div>` : "";
    // Lista: do 4º lugar em diante (e a linha do próprio jogador, se estiver mais abaixo)
    let anterior = topo3.length ? Number(topo3[topo3.length - 1].posicao) : 0, linhas = "";
    data.filter(r => !topo3.includes(r)).forEach(r => {
      const pos = Number(r.posicao), n = Number(r.ovos);
      if (pos > anterior + 1) linhas += `<li class="gap">⋯</li>`;
      linhas += `<li class="${r.sou_eu ? "eu" : ""}">
        <span class="pos">${medalhaDe(pos)}</span>
        <span class="quem">${esc(r.nome)}</span>
        ${qtdOvos(n)}
        <span class="quando">${dataHora(r.conseguido_em)}</span>
      </li>`;
      anterior = pos;
    });
    alvo.innerHTML = podio + (linhas ? `<ol class="ranking">${linhas}</ol>` : "");
  } catch (err) {
    if (document.body.contains(alvo)) alvo.innerHTML = `<p class="ranking-msg">Não foi possível carregar o ranking.</p>`;
  }
}

iniciarPagina().then(ok => { if (ok) telaRanking(); });
