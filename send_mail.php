<?php
// send_mail.php - production-ready: sends form details to contact@prorhythmx.com
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require __DIR__ . '/lib/PHPMailer/src/Exception.php';
require __DIR__ . '/lib/PHPMailer/src/PHPMailer.php';
require __DIR__ . '/lib/PHPMailer/src/SMTP.php';

// load config from outside webroot (one level up)
$configPath = __DIR__ . '/../prx_config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Configuration not found']);
    exit;
}
$config = require $configPath;

header('Content-Type: application/json; charset=utf-8');

// Honeypot to trap bots
if (!empty($_POST['hp_field'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request']);
    exit;
}

// Read fields (match your form 'name' attributes)
$name          = trim($_POST['name'] ?? '');
//$fullName      = trim($_POST['fullName'] ?? '');
$email         = trim($_POST['email'] ?? '');
$businessEmail = trim($_POST['businessEmail'] ?? '');
$company       = trim($_POST['company'] ?? '');
//$organization  = trim($_POST['organization'] ?? '');
$subject       = trim($_POST['subject'] ?? 'Website contact');
$message       = trim($_POST['message'] ?? '');

if (!$name || !$email || !$businessEmail || !$company || !$subject || !$message) {
    http_response_code(422);
    echo json_encode(['error' => 'Missing required fields']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !filter_var($businessEmail, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['error' => 'Invalid email address']);
    exit;
}

try {
    $mail = new PHPMailer(true);
    // SMTP config from config.php
    $smtp = $config['smtp'];
    $mail->isSMTP();
    $mail->Host       = $smtp['host'];
    $mail->SMTPAuth   = true;
    $mail->Username   = $smtp['username'];
    $mail->Password   = $smtp['password'];
    $mail->SMTPSecure = $smtp['secure'];
    $mail->Port       = $smtp['port'];
    $mail->Timeout    = 15;

    // message
    $mail->setFrom($config['mail']['from_email'], $config['mail']['from_name']);
    $mail->addReplyTo($businessEmail ?: $email, $name);
    $mail->addAddress($config['mail']['to_email'], $config['mail']['to_name']);

    $mail->isHTML(true);
    $mail->Subject = "[Website] " . $subject;

    $body  = "<h3>New contact form submission</h3>";
    $body .= "<p><strong>Name:</strong> " . htmlspecialchars($name) . "</p>";
   // $body .= "<p><strong>Full Name:</strong> " . htmlspecialchars($fullName) . "</p>";
    $body .= "<p><strong>Email:</strong> " . htmlspecialchars($email) . "</p>";
    $body .= "<p><strong>Business Email:</strong> " . htmlspecialchars($businessEmail) . "</p>";
    $body .= "<p><strong>Company:</strong> " . htmlspecialchars($company) . "</p>";
    //$body .= "<p><strong>Organization:</strong> " . htmlspecialchars($organization) . "</p>";
    $body .= "<p><strong>Subject:</strong> " . htmlspecialchars($subject) . "</p>";
    $body .= "<p><strong>Message:</strong><br>" . nl2br(htmlspecialchars($message)) . "</p>";

    $mail->Body = $body;
    $mail->AltBody = strip_tags($body);

    $mail->send();

    // OPTIONAL: send a lightweight autoresponse to the visitor
    // Uncomment block below to enable sender confirmation emails
    
    $auto = new PHPMailer(true);
    $auto->isSMTP();
    $auto->Host       = $smtp['host'];
    $auto->SMTPAuth   = true;
    $auto->Username   = $smtp['username'];
    $auto->Password   = $smtp['password'];
    $auto->SMTPSecure = $smtp['secure'];
    $auto->Port       = $smtp['port'];
   
    $auto->setFrom($config['mail']['from_email'], $config['mail']['from_name']);
    $auto->addAddress($businessEmail, $name);
    $auto->Subject = "Received your message";
    $auto->isHTML(true);
    $auto->Body = "<p>Hi " . htmlspecialchars($name) . ",</p><p>Thanks for reaching out. We received your message and will reply within 24 hours.</p><p>ProRhythmX Team</p>";
    $auto->send();
    

    echo json_encode(['success' => true, 'message' => 'Message sent successfully']);
    exit;
} catch (Exception $e) {
    error_log('Mailer error: ' . ($mail->ErrorInfo ?? $e->getMessage()));
    http_response_code(500);
    echo json_encode(['error' => 'Unable to send message at this time.']);
    exit;
}