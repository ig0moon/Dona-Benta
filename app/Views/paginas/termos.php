<?= $this->extend('layouts/main') ?>

<?= $this->section('content') ?>
  <section class="pagina-header">
    <div class="container">
      <span class="eyebrow">Transparência</span>
      <h1>Termos e Condições de Compra</h1>
      <p>As regras dos pedidos feitos pelo site, de acordo com o Código de Defesa do Consumidor e o Decreto 7.962/2013.</p>
    </div>
  </section>

  <main class="secao">
    <div class="container texto-legal" style="max-width: 760px; line-height: 1.7;">
      <h2>1. Quem vende</h2>
      <p>
        <?= esc($loja->nomeFantasia) ?><?= $loja->razaoSocial !== '' ? ' — ' . esc($loja->razaoSocial) : '' ?><?= $loja->cnpj !== '' ? ', CNPJ ' . esc($loja->cnpj) : '' ?>.<br>
        Endereço: <?= esc($loja->endereco) ?>.<br>
        Atendimento: WhatsApp <?= esc($loja->whatsapp) ?><?php if ($loja->email !== ''): ?> e e-mail <a href="mailto:<?= esc($loja->email, 'attr') ?>"><?= esc($loja->email) ?></a><?php endif ?>, de segunda a sábado, das 8h às 19h.
      </p>

      <h2>2. Produtos e informações</h2>
      <ul>
        <li>Nossos produtos são artesanais e feitos sob encomenda. Cor, formato, tamanho e decoração podem ter pequenas variações em relação às fotos, que são <strong>meramente ilustrativas</strong>.</li>
        <li><strong>Alergias e restrições:</strong> nossa cozinha manipula trigo (glúten), leite, ovos, soja, amendoim e castanhas, e os produtos podem conter traços desses ingredientes. Se você ou alguém que vai consumir tem alergia ou restrição alimentar, fale com a gente <strong>antes</strong> de fazer o pedido para confirmar os ingredientes.</li>
        <li>Por serem perecíveis, os produtos devem ser consumidos e conservados conforme a orientação da loja (em geral, refrigerados os que levam creme, recheio ou cobertura).</li>
      </ul>

      <h2>3. Preços e pagamento</h2>
      <ul>
        <li>Os preços mostrados no site estão em reais e são os cobrados no momento do pedido. O valor total aparece no resumo antes do pagamento.</li>
        <li>Se houver taxa de entrega, ela será informada antes da confirmação do pedido. Nenhum valor além do que você aceitou será cobrado.</li>
        <li>Os pagamentos online (Pix e cartão) são processados pelo Mercado Pago. O pedido só é confirmado depois que o pagamento é aprovado.</li>
        <li>Se um preço aparecer no site com um erro evidente (por exemplo, um bolo por R$ 0,01), entraremos em contato antes de produzir para corrigir ou cancelar o pedido com devolução integral do que foi pago.</li>
      </ul>

      <h2>4. Pedido e confirmação</h2>
      <ul>
        <li>Antes de pagar, você vê o resumo com os produtos, as quantidades, o total, a data, o horário e a forma de entrega.</li>
        <li>Depois de feito, o pedido aparece em <a href="conta?aba=pedidos">Minha conta → Meus pedidos</a>, com o número e a situação atualizada (aguardando, confirmado, em preparo, pronto, entregue).</li>
        <li>Pedimos antecedência mínima de 1 dia para pães e doces e de 2 dias para bolos e tortas personalizadas. Se não for possível atender a data escolhida, avisaremos e você poderá escolher outra data ou cancelar com reembolso integral.</li>
      </ul>

      <h2>5. Entrega e retirada</h2>
      <ul>
        <li>Você pode retirar na loja ou receber no endereço informado, em Ponta Grossa e região.</li>
        <li>Confira o endereço antes de confirmar. Se ninguém estiver no local no horário combinado, entraremos em contato para combinar uma nova entrega.</li>
        <li>Confira o produto no recebimento. Se houver algum problema, fale com a gente o quanto antes, de preferência com uma foto.</li>
      </ul>

      <h2>6. Cancelamento e reembolso</h2>
      <ul>
        <li><strong>Antes do pagamento:</strong> o pedido ainda não está confirmado e não gera nenhuma cobrança. Se quiser desistir, basta não pagar ou nos avisar.</li>
        <li><strong>Depois do pagamento e antes do início do preparo:</strong> fale com a gente pelo WhatsApp ou e-mail informando o número do pedido. O valor pago é devolvido integralmente, pelo mesmo meio de pagamento.</li>
        <li><strong>Depois do início do preparo:</strong> como os produtos são perecíveis e feitos especialmente para você, o cancelamento depende do que já foi produzido. Vamos sempre buscar uma solução justa (nova data, troca ou reembolso total ou parcial).</li>
        <li><strong>Problema por nossa causa</strong> (atraso, produto diferente do pedido, com defeito ou impróprio para consumo): você escolhe entre a troca do produto, um novo agendamento ou a devolução integral do valor, como garante o Código de Defesa do Consumidor.</li>
        <li>Reembolsos por Pix ou cartão são feitos pelo Mercado Pago; o prazo para o valor aparecer na fatura do cartão depende da operadora.</li>
      </ul>
      <p>Nada nestes termos limita os direitos que o Código de Defesa do Consumidor garante a você.</p>

      <h2>7. Sua conta</h2>
      <p>Você é responsável por manter sua senha em segredo e pelos dados que informa. Você pode corrigir seus dados, baixar uma cópia deles ou excluir a conta a qualquer momento em <a href="conta">Minha conta</a>. O uso dos seus dados segue a nossa <a href="privacidade">Política de Privacidade</a>.</p>

      <h2>8. Atendimento e reclamações</h2>
      <p>Fale primeiro com a gente pelo WhatsApp <?= esc($loja->whatsapp) ?><?php if ($loja->email !== ''): ?> ou pelo e-mail <a href="mailto:<?= esc($loja->email, 'attr') ?>"><?= esc($loja->email) ?></a><?php endif ?>; respondemos em até 5 dias úteis. Você também pode procurar o Procon ou a plataforma <a href="https://www.consumidor.gov.br" target="_blank" rel="noopener noreferrer">consumidor.gov.br</a>.</p>

      <h2>9. Foro</h2>
      <p>Para qualquer disputa, vale a legislação brasileira, e você pode escolher o foro do seu domicílio, como prevê o Código de Defesa do Consumidor.</p>

      <p style="color: var(--marrom-claro); margin-top: 32px;">Última atualização: 17 de novembro de 2026.</p>
    </div>
  </main>
<?= $this->endSection() ?>
