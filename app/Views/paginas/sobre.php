<?= $this->extend('layouts/main') ?>

<?= $this->section('content') ?>
  <section class="pagina-header">
    <div class="container">
      <span class="eyebrow">Nossa história</span>
      <h1>Conheça a Dona Benta</h1>
      <p>Uma paixão por confeitaria que virou tradição de família.</p>
    </div>
  </section>

  <main>
    <section class="secao">
      <div class="container sobre-hero">
        <div class="sobre-hero-media">
          <img src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80" alt="Confeiteira preparando receitas artesanais na cozinha" loading="lazy">
        </div>
        <div class="sobre-hero-conteudo">
          <h2>Tudo começou em uma cozinha pequena</h2>
          <p class="sobre-hero-desc">A Dona Benta nasceu do sonho de compartilhar receitas de família com toda a vizinhança. O que começou com bolos de aniversário para amigos próximos se tornou uma padaria e confeitaria querida pela comunidade.</p>
          <p class="sobre-hero-desc">Hoje, seguimos fiéis à mesma receita de sempre: ingredientes selecionados, processos artesanais e, acima de tudo, muito carinho em cada produto que sai do nosso forno.</p>
          <div class="sobre-hero-acoes">
            <a href="<?= base_url('catalogo') ?>" class="btn btn-primario">
              <span class="material-symbols-outlined">storefront</span>
              Ver catálogo
            </a>
          </div>
        </div>
      </div>
    </section>

    <section class="secao" style="background: var(--creme-escuro);">
      <div class="container">
        <div class="secao-titulo">
          <span class="eyebrow">O que nos move</span>
          <h2>Nossos valores</h2>
        </div>
        <div class="valores-grade">
          <div class="cartao valor-cartao">
            <span class="material-symbols-outlined">eco</span>
            <h3 style="font-size: 1.1rem; margin-bottom: 6px;">Ingredientes de verdade</h3>
            <p style="color: var(--marrom-claro); font-size: 0.9rem;">Sem conservantes ou atalhos — só o que é fresco e de qualidade.</p>
          </div>
          <div class="cartao valor-cartao">
            <span class="material-symbols-outlined">handshake</span>
            <h3 style="font-size: 1.1rem; margin-bottom: 6px;">Feito à mão</h3>
            <p style="color: var(--marrom-claro); font-size: 0.9rem;">Cada produto passa pelas mãos da nossa equipe com cuidado artesanal.</p>
          </div>
          <div class="cartao valor-cartao">
            <span class="material-symbols-outlined">favorite</span>
            <h3 style="font-size: 1.1rem; margin-bottom: 6px;">Receita de família</h3>
            <p style="color: var(--marrom-claro); font-size: 0.9rem;">Tradições passadas de geração em geração, com afeto em cada fatia.</p>
          </div>
        </div>
      </div>
    </section>
  </main>
<?= $this->endSection() ?>
