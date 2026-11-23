// Página Conta (a engrenagem): trocar senha, sair e excluir conta.
// ---- Tela 4: Configurações ----
function telaConfig() {
  const email = sessao?.user?.email || "";
  app.innerHTML = `
    <div class="config estreito">
      <h2>Configurações</h2>

      <form class="card config-bloco" id="f-senha" autocomplete="off">
        <h3>${ic("cadeado")}Trocar senha</h3>
        <p class="config-info">Conta: <b>${esc(email)}</b></p>
        <label for="nova1">Nova senha</label>
        <input id="nova1" type="password" required minlength="6" autocomplete="new-password">
        <label for="nova2">Repita a nova senha</label>
        <input id="nova2" type="password" required minlength="6" autocomplete="new-password">
        <div class="msg" id="m-senha" role="status"></div>
        <button class="btn" id="go-senha">Salvar nova senha</button>
      </form>

      <div class="card config-bloco">
        <h3>${ic("porta")}Sair</h3>
        <p class="config-info">Sai da sua conta neste aparelho. Seus ovos continuam salvos.</p>
        <button class="btn btn-secundario" id="go-sair">Sair da conta</button>
      </div>

      <div class="card config-bloco perigo">
        <h3>${ic("lixeira")}Excluir conta</h3>
        <p class="config-info">Apaga a sua conta <b>para sempre</b>, junto com todos os ovos encontrados,
          a sua posição nos rankings e as pistas vistas. Não dá para desfazer.</p>
        <div id="excluir-passo1"><button class="btn btn-perigo" id="go-excluir1">Quero excluir minha conta</button></div>
        <div id="excluir-passo2" hidden>
          <label for="conf-excluir">Para confirmar, digite <b>EXCLUIR</b></label>
          <input id="conf-excluir" autocomplete="off" spellcheck="false">
          <div class="msg" id="m-excluir" role="status"></div>
          <div class="config-botoes">
            <button class="btn btn-secundario" id="go-cancelar">Cancelar</button>
            <button class="btn btn-perigo" id="go-excluir2" disabled>Excluir para sempre</button>
          </div>
        </div>
      </div>
    </div>`;

  // trocar senha
  document.getElementById("f-senha").onsubmit = async e => {
    e.preventDefault();
    const n1 = document.getElementById("nova1").value, n2 = document.getElementById("nova2").value;
    const m = document.getElementById("m-senha"), go = document.getElementById("go-senha");
    if (n1 !== n2) { m.className = "msg err"; m.textContent = "As duas senhas não são iguais."; return; }
    go.disabled = true; m.className = "msg"; m.textContent = "Salvando…";
    try {
      const { error } = await sb.auth.updateUser({ password: n1 });
      if (error) throw error;
      m.className = "msg ok"; m.textContent = "Senha trocada! Use a nova senha da próxima vez que entrar.";
      document.getElementById("nova1").value = ""; document.getElementById("nova2").value = "";
    } catch (err) {
      m.className = "msg err";
      m.textContent = /different from the old/i.test(err.message || "") ? "A nova senha precisa ser diferente da atual." : traduzErro(err);
    }
    go.disabled = false;
  };

  // sair
  document.getElementById("go-sair").onclick = () => sair();

  // excluir conta (dois passos + digitar EXCLUIR)
  const p1 = document.getElementById("excluir-passo1"), p2 = document.getElementById("excluir-passo2");
  const conf = document.getElementById("conf-excluir"), go2 = document.getElementById("go-excluir2");
  document.getElementById("go-excluir1").onclick = () => { p1.hidden = true; p2.hidden = false; conf.focus(); };
  document.getElementById("go-cancelar").onclick = () => { p2.hidden = true; p1.hidden = false; conf.value = ""; go2.disabled = true; };
  conf.oninput = () => { go2.disabled = conf.value.trim().toUpperCase() !== "EXCLUIR"; };
  go2.onclick = async () => {
    const m = document.getElementById("m-excluir");
    go2.disabled = true; m.className = "msg"; m.textContent = "Excluindo…";
    try {
      const { error } = await sb.rpc("excluir_minha_conta");
      if (error) throw error;
      await sair("Sua conta foi excluída.", "ok");
    } catch (err) {
      m.className = "msg err"; m.textContent = traduzErro(err);
      go2.disabled = false;
    }
  };
}

iniciarPagina().then(ok => { if (ok) telaConfig(); });
