<?php
// config.php - store outside webroot, DO NOT commit to source control

return [
    'smtp' => [
        'host'     => 'smtpout.secureserver.net',   // or smtp.titan.email
        'port'     => 465,                          // 465 for SSL, 587 for TLS
        'secure'   => 'ssl',                        // 'ssl' or 'tls'
        'username' => 'info@anssoft.in',
        'password' => 'Connect1@3456'
    ],
    'mail' => [
        'from_email' => 'info@anssoft.in',
        'from_name'  => 'ANS Website',
        'to_email'   => 'info@anssoft.in',
        'to_name'    => 'ANS'
    ]
];