// Página de entrada: apresentação, entrar e criar conta.
// Quem já está logado vai direto para as pistas.
let modo = "entrar";       // "entrar" | "cadastrar"

// ---- Login / Cadastro ----
function telaLogin(msg = "", tipo = "err") {
  const cad = modo === "cadastrar";
  document.getElementById("cabecalho").innerHTML = "";   // sem "Olá" e abas no login
  document.getElementById("saudacao").textContent = "";
  app.innerHTML = `
    <div class="estreito entrada">
      <div class="tabuleta-sombra">
        <div class="tabuleta">
          ${SIGILO}
          <p class="convite">O Mago escondeu ovos por toda parte. Siga as pistas, encontre as chaves e prove que é o melhor caçador.</p>
        </div>
      </div>
      <p class="autor center"><span class="brilho-aura">Mago dos Ovos</span> criou os ovos.</p>
      <p class="sub center">${cad ? "Crie sua conta para começar a caçar." : "Entre na sua conta para começar a caçar."}</p>
      <form class="card" id="f">
        ${cad ? `<label for="n">Seu nome</label><input id="n" required autocomplete="nickname" maxlength="40">` : ""}
        <label for="u">E-mail</label>
        <input id="u" type="email" required autocomplete="email">
        <label for="p">Senha da conta</label>
        <input id="p" type="password" required minlength="6" autocomplete="${cad ? "new-password" : "current-password"}">
        <div class="msg ${tipo}" id="m">${esc(msg)}</div>
        <button class="btn" id="go">${cad ? "Criar conta" : "Entrar"}</button>
        <p class="center" style="margin:12px 0 0">
          <button type="button" class="link" id="troca">${cad ? "Já tenho conta — entrar" : "Não tenho conta — criar"}</button>
        </p>
      </form>
    </div>`;
  document.getElementById("troca").onclick = () => { modo = cad ? "entrar" : "cadastrar"; telaLogin(); };
  document.getElementById("f").onsubmit = async e => {
    e.preventDefault();
    const go = document.getElementById("go"), m = document.getElementById("m");
    const email = document.getElementById("u").value.trim();
    const password = document.getElementById("p").value;
    go.disabled = true; m.className = "msg"; m.textContent = "Aguarde…";
    try {
      if (cad) {
        const nome = document.getElementById("n").value.trim();
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { nome } } });
        if (error) throw error;
        if (!data.session) {
          modo = "entrar";
          return telaLogin("Conta criada! Abra o link que enviamos para o seu e-mail e depois entre aqui.", "ok");
        }
        sessao = data.session;
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        sessao = data.session;
      }
      location.assign("/pistas/");
    } catch (err) {
      m.className = "msg err"; m.textContent = traduzErro(err);
      go.disabled = false;
    }
  };
}

(async () => {
  if (!sb) { mostrarFalha("Não foi possível carregar o jogo. Verifique sua internet."); return; }
  const { data } = await sb.auth.getSession();
  if (data.session) { location.replace("/pistas/"); return; }
  // aviso deixado por outra página (ex.: "Sua conta foi excluída.")
  let aviso = null;
  try { aviso = JSON.parse(sessionStorage.getItem("aviso")); sessionStorage.removeItem("aviso"); } catch { /* sem aviso */ }
  telaLogin(aviso?.msg || "", aviso?.tipo || "err");
})();
