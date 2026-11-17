<?= $this->extend('layouts/main') ?>

<?= $this->section('content') ?>
  <section class="pagina-header">
    <div class="container">
      <span class="eyebrow">Sobre</span>
      <h1>Conheça a Dona Benta.</h1>
      <p>Uma paixão por confeitaria que virou tradição de família.</p>
    </div>
  </section>

  <main>
    <section class="secao">
      <div class="container sobre-historia">
        <div class="rv">
          <div>
            <img src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=900&q=75" alt="Equipe preparando receitas artesanais na cozinha" loading="lazy">
          </div>
        </div>
        <div class="rv">
          <h2>Tudo começou em uma cozinha pequena.</h2>
          <p>A Dona Benta nasceu do sonho de compartilhar receitas de família com toda a vizinhança. O que começou com bolos de aniversário para amigos próximos se tornou uma padaria e confeitaria querida pela comunidade.</p>
          <p>Hoje seguimos fiéis à mesma receita de sempre: ingredientes selecionados, processos artesanais e, acima de tudo, muito carinho em cada produto que sai do nosso forno.</p>
          <a href="<?= base_url('catalogo') ?>" class="btn btn-primario">Ver o cardápio <span class="seta" aria-hidden="true">→</span></a>
        </div>
      </div>
    </section>

    <section class="manifesto">
      <div class="container">
        <p class="manifesto-texto" data-scroll-reveal>Receita boa não tem atalho. Tem tempo de fermentação, manteiga de verdade, forno no ponto e alguém olhando cada fornada como se fosse para a própria família.</p>
      </div>
    </section>

    <section class="secao">
      <div class="container">
        <div class="secao-titulo rv">
          <h2>O que nos move.</h2>
        </div>
        <div class="valores rv">
          <div class="valor">
            <h3>Ingredientes de verdade</h3>
            <p>Sem conservantes ou atalhos. Só o que é fresco e de qualidade.</p>
          </div>
          <div class="valor">
            <h3>Feito à mão</h3>
            <p>Cada produto passa pelas mãos da nossa equipe com cuidado artesanal.</p>
          </div>
          <div class="valor">
            <h3>Receita de família</h3>
            <p>Tradições passadas de geração em geração, com afeto em cada fatia.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="secao" style="padding-top:0;">
      <div class="container">
        <div class="chamada rv">
          <div class="aurora" aria-hidden="true"><b></b><b></b><b></b></div>
          <h2>Venha provar de perto.</h2>
          <p>Rua Padre Anacleto, 1168 — Nova Rússia, Ponta Grossa. De segunda a sábado, das 8h às 19h.</p>
          <div class="inicio-acoes">
            <a href="<?= base_url('catalogo') ?>" class="btn btn-primario">Encomendar online <span class="seta" aria-hidden="true">→</span></a>
            <a href="https://api.whatsapp.com/send?phone=5542999823994&text=Ol%C3%A1!%20Vim%20pelo%20site%20Dona%20Benta" target="_blank" rel="noopener noreferrer" class="btn btn-outline">Falar no WhatsApp</a>
          </div>
        </div>
      </div>
    </section>
  </main>
<?= $this->endSection() ?>
