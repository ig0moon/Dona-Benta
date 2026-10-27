<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="<?= esc($descricao ?? 'Dona Benta — Confeitaria e Padaria Artesanal em Ponta Grossa. Pães de fermentação natural, bolos caseiros, doces e tortas para encomenda.') ?>">
  <title><?= esc($titulo ?? 'Dona Benta — Confeitaria e Padaria Artesanal') ?></title>
  <base href="<?= base_url('/') ?>">
  <link rel="shortcut icon" href="<?= base_url('img/favicon.png') ?>" type="image/x-icon">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200">
  <link rel="stylesheet" href="<?= base_url('css/style.css?v=3.0') ?>">
  <?= $this->renderSection('styles') ?>
  <script>
    (function(){
      try {
        if(localStorage.getItem('donaBentaTema') === 'escuro'){
          document.documentElement.setAttribute('data-tema', 'escuro');
        }
      } catch(e){}
    })();
    window.BASE_URL = '<?= base_url('/') ?>';
    window.API_PAGAMENTOS_URL = '<?= base_url('api') ?>';
  </script>
</head>
<body data-pagina="<?= esc($pagina ?? 'inicio') ?>">

  <?= $this->renderSection('content') ?>

  <!-- Scripts Globais MVC -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="<?= base_url('js/supabase-client.js?v=3.0') ?>"></script>
  <script src="<?= base_url('js/carrinho.js?v=3.0') ?>"></script>
  <script src="<?= base_url('js/layout.js?v=3.0') ?>"></script>
  <?= $this->renderSection('scripts') ?>
</body>
</html>
