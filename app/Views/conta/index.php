<?= $this->extend('layouts/main') ?>

<?= $this->section('content') ?>
  <div class="container container-painel">
    <div class="conta-layout" id="contaLayout">
      <div class="spinner"></div>
    </div>
  </div>
<?= $this->endSection() ?>

<?= $this->section('scripts') ?>
  <script src="<?= base_url('js/conta.js?v=5.0') ?>"></script>
<?= $this->endSection() ?>
