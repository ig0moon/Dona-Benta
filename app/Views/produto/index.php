<?= $this->extend('layouts/main') ?>

<?= $this->section('content') ?>
  <main class="secao">
    <div class="container container-produto">
      <div class="produto-topo-navegacao">
        <a href="<?= base_url('catalogo') ?>" class="btn btn-outline btn-voltar">
          <span class="material-symbols-outlined">arrow_back</span> Voltar ao catálogo
        </a>
      </div>

      <div id="areaProduto">
        <div class="spinner"></div>
      </div>
    </div>
  </main>
<?= $this->endSection() ?>

<?= $this->section('scripts') ?>
  <script src="<?= base_url('js/produto.js?v=3.0') ?>"></script>
<?= $this->endSection() ?>
