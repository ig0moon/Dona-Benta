<?= $this->extend('layouts/main') ?>

<?= $this->section('content') ?>
  <main>
    <section class="inicio-hero">
      <div class="container">
        <div>
          <div class="ao-vivo"><i aria-hidden="true"></i><span class="texto-brilho">Saindo do forno hoje, feito à mão</span></div>
          <h1 data-split>Sabores que lembram a casa da <em>vovó.</em></h1>
          <p class="inicio-hero-sub" data-blur="700">Pães, bolos e doces artesanais com receitas de família. Encomende online e receba fresquinho.</p>
          <div class="inicio-acoes">
            <a href="<?= base_url('catalogo') ?>" class="btn btn-primario" data-magnet>Ver o cardápio <span class="seta" aria-hidden="true">→</span></a>
            <a href="<?= base_url('sobre') ?>" class="btn btn-outline">Nossa história</a>
          </div>
          <div class="inicio-numeros">
            <div><b data-contar="20" data-prefixo="+">+20</b><span>anos de receitas</span></div>
            <div><b data-contar="5">5</b><span>categorias no cardápio</span></div>
            <div><b data-contar="100" data-sufixo="%">100%</b><span>feito à mão</span></div>
          </div>
        </div>

        <div class="tilt-area">
          <a href="<?= base_url('catalogo') ?>" class="destaque-card" id="destaqueCard" data-tilt aria-label="Ver produto em destaque">
            <img id="destaqueImagem" src="https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1000&q=75" alt="Bolo de chocolate da Dona Benta">
            <span class="tilt-brilho" aria-hidden="true"></span>
            <div class="destaque-etiqueta" id="destaqueEtiqueta">
              <div>
                <h3 id="destaqueNome">Bolos da casa</h3>
                <small id="destaqueCategoria">Feitos sob encomenda</small>
              </div>
              <strong id="destaquePreco">Ver →</strong>
            </div>
          </a>
        </div>
      </div>
    </section>

    <div class="faixa-loop" aria-hidden="true">
      <div class="faixa-loop-trilho" id="faixaLoop"></div>
    </div>

    <section class="secao">
      <div class="container">
        <div class="secao-titulo rv">
          <h2>Do forno para a sua mesa.</h2>
          <p>Do pão de cada dia às tortas de comemoração. Escolha por onde começar.</p>
        </div>
        <div class="categorias-fotos rv">
          <a href="<?= base_url('catalogo?categoria=bolos') ?>" class="categoria-foto spotlight">
            <img src="https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?w=600&q=70" alt="" loading="lazy"><span>Bolos</span>
          </a>
          <a href="<?= base_url('catalogo?categoria=paes') ?>" class="categoria-foto spotlight">
            <img src="https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=70" alt="" loading="lazy"><span>Pães</span>
          </a>
          <a href="<?= base_url('catalogo?categoria=doces') ?>" class="categoria-foto spotlight">
            <img src="https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=70" alt="" loading="lazy"><span>Doces</span>
          </a>
          <a href="<?= base_url('catalogo?categoria=salgados') ?>" class="categoria-foto spotlight">
            <img src="https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=70" alt="" loading="lazy"><span>Salgados</span>
          </a>
          <a href="<?= base_url('catalogo?categoria=tortas') ?>" class="categoria-foto spotlight">
            <img src="https://images.unsplash.com/photo-1464305795204-6f5bbfc7fb81?w=600&q=70" alt="" loading="lazy"><span>Tortas</span>
          </a>
        </div>
      </div>
    </section>

    <section class="secao" style="padding-top:0;">
      <div class="container">
        <div class="secao-titulo rv">
          <h2>Os favoritos da casa.</h2>
          <p>Uma seleção do que os nossos clientes mais pedem.</p>
        </div>
        <div class="destaques-grade" id="destaquesGrade">
          <div class="spinner"></div>
        </div>
      </div>
    </section>

    <section class="manifesto">
      <div class="container">
        <p class="manifesto-texto" data-scroll-reveal>A gente acorda antes do sol, sova a massa com calma e espera o fermento fazer o tempo dele. Nada de pressa, nada de conservante. Só o cheiro de bolo saindo do forno, igual à casa da vovó.</p>
        <div class="manifesto-fotos rv">
          <img src="https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900&q=70" alt="Pães de fermentação natural" loading="lazy">
          <img src="https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?w=700&q=70" alt="Bolo sendo confeitado" loading="lazy">
          <img src="https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=900&q=70" alt="Pão fatiado" loading="lazy">
        </div>
      </div>
    </section>

    <section class="secao">
      <div class="container">
        <div class="secao-titulo rv">
          <h2>Encomendar é simples.</h2>
        </div>
        <div class="passos rv">
          <div class="passo">
            <h3>Escolha</h3>
            <p>Monte sua sacola com bolos, pães, doces, salgados e tortas do cardápio.</p>
          </div>
          <div class="passo">
            <h3>Agende</h3>
            <p>Escolha o dia e o horário, e se prefere retirar na loja ou receber em casa.</p>
          </div>
          <div class="passo">
            <h3>Aproveite</h3>
            <p>Pague com Pix ou cartão e acompanhe o pedido pela sua conta.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="secao" style="padding-top:0;">
      <div class="container">
        <div class="chamada rv">
          <div class="aurora" aria-hidden="true"><b></b><b></b><b></b></div>
          <h2>Bateu a vontade de um docinho?</h2>
          <p>Monte seu pedido agora e combine a data de retirada ou entrega.</p>
          <div class="inicio-acoes">
            <a href="<?= base_url('catalogo') ?>" class="btn btn-primario" data-magnet>Ver o cardápio <span class="seta" aria-hidden="true">→</span></a>
            <a href="https://api.whatsapp.com/send?phone=5542999823994&text=Ol%C3%A1!%20Vim%20pelo%20site%20Dona%20Benta" target="_blank" rel="noopener noreferrer" class="btn btn-outline">Falar no WhatsApp</a>
          </div>
        </div>
      </div>
    </section>
  </main>
<?= $this->endSection() ?>

<?= $this->section('scripts') ?>
  <script src="<?= base_url('js/inicio.js?v=1.0') ?>"></script>
<?= $this->endSection() ?>
