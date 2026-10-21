// =====================================================================
//  Caça aos Ovos — conexão das PÁGINAS DE DESAFIO com o Supabase
//  Fica na raiz do site (ao lado do index.html) e serve para qualquer
//  página especial (radar, labirintos, quebra-cabeças...).
//
//  Como usar numa página nova (ex.: pasta "portal/index.html"):
//    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
//    <script src="../desafio.js"></script>
//    const sessao = await Desafio.sessao();            // null = não está logado
//    const st     = await Desafio.status("portal");    // {existe, resolvido, recompensa_texto?...}
//    const r      = await Desafio.responder("portal", "codigo-gerado-pelo-jogo");
//                   // r.status: "certo" | "errado" | "aguarde" | "invalido"
//
//  A página nunca sabe a resposta nem a recompensa: quem decide é o Supabase.
//  O login é o mesmo do jogo (mesmo endereço = mesma sessão).
// =====================================================================
(() => {
  const SUPABASE_URL = "https://xjgpxdojkpuzcspypeby.supabase.co";
  const SUPABASE_KEY = "sb_publishable_SVtXrEDZI6T6-kFRFFFq8A__ez2hWaq";

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  async function rpc(nome, args) {
    const { data, error } = await sb.rpc(nome, args);
    if (error) throw error;
    return data;
  }

  // Link temporário para a imagem de recompensa (Storage → recompensas) ou o próprio link https://
  async function imagemRecompensa(nome) {
    if (!nome) return null;
    if (/^https?:\/\//i.test(nome.trim())) return nome.trim();
    const { data, error } = await sb.storage.from("recompensas").createSignedUrl(nome, 3600);
    return error ? null : data.signedUrl;
  }

  // Texto da recompensa com [[palavra]] destacada (mesma ideia do site principal)
  function textoRecompensa(s) {
    const esc = String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    return esc.replace(/\[\[(?:(?:aura|reflexo|estrelas):)?([^\]]+?)\]\]/gi, '<span class="destaque">$1</span>');
  }

  window.Desafio = {
    sb,
    async sessao() {
      const { data } = await sb.auth.getSession();
      return data.session;
    },
    status: slug => rpc("status_desafio", { p_slug: slug }),
    responder: (slug, resposta) => rpc("responder_desafio", { p_slug: slug, p_resposta: resposta }),
    imagemRecompensa,
    textoRecompensa,
  };
})();
