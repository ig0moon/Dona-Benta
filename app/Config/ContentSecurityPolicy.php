<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * Content Security Policy configurada e blindada para a Dona Benta
 */
class ContentSecurityPolicy extends BaseConfig
{
    public bool $reportOnly = false;
    public ?string $reportURI = null;
    public ?string $reportTo = null;
    public bool $upgradeInsecureRequests = false;

    public $defaultSrc = 'self';

    public $scriptSrc = [
        'self',
        'unsafe-inline',
    ];

    public array|string $scriptSrcElem = [
        'self',
        'unsafe-inline',
    ];

    public array|string $scriptSrcAttr = [
        'self',
        'unsafe-inline'
    ];

    public $styleSrc = [
        'self',
        'unsafe-inline',
        'https://fonts.googleapis.com'
    ];

    public array|string $styleSrcElem = [
        'self',
        'unsafe-inline',
        'https://fonts.googleapis.com'
    ];

    public array|string $styleSrcAttr = [
        'self',
        'unsafe-inline'
    ];

    public $imageSrc = [
        'self',
        'data:',
        'blob:',
        'https://images.unsplash.com',
    ];

    public $baseURI = 'self';
    public $childSrc = 'self';

    public $connectSrc = [
        'self'
    ];

    public $fontSrc = [
        'self',
        'https://fonts.gstatic.com'
    ];

    public $formAction = 'self';
    public $frameAncestors = 'self';

    public $frameSrc = 'self';

    public $mediaSrc = 'self';
    public $objectSrc = 'none';
    public $manifestSrc = 'self';
    public array|string $workerSrc = ['self', 'blob:'];

    public ?string $pluginTypes = null;
    public ?string $sandbox = null;

    public string $styleNonceTag = '{csp-style-nonce}';
    public string $scriptNonceTag = '{csp-script-nonce}';
    public bool $autoNonce = false;
}
