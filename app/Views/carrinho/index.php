<?= $this->extend('layouts/main') ?>

<?= $this->section('content') ?>
  <section class="pagina-header">
    <div class="container">
      <span class="eyebrow">Seu carrinho</span>
      <h1>Revise seu pedido</h1>
      <p>Confira os itens antes de seguir para o agendamento e confirmação.</p>
    </div>
  </section>

  <main class="container">
    <div class="carrinho-layout" id="carrinhoLayout">
      <div class="spinner"></div>
    </div>
  </main>
<?= $this->endSection() ?>
