#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');

function printUsage() {
  console.log(`\nEstatesNearMe deploy\n\nUsage:\n  npm run deploy -- <production|development> [region]\n  npm run deploy:production\n  npm run deploy:development\n\nNotes:\n  - Loads variables from .env.production or .env.development at the repo root\n  - Use DEPLOY_ENVIRONMENT in the env file if the CloudFormation environment name differs\n`);
}

function parseEnvFile(content) {
  const values = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function loadDeploymentEnv(target) {
  const envFilePath = path.join(rootDir, `.env.${target}`);

  if (!fs.existsSync(envFilePath)) {
    throw new Error(`Missing ${path.basename(envFilePath)} at repo root.`);
  }

  const fileValues = parseEnvFile(fs.readFileSync(envFilePath, 'utf8'));
  return {
    envFilePath,
    values: {
      ...fileValues,
      ...process.env,
    },
  };
}

function ensureRequired(config, keys) {
  const missing = keys.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required deployment variables: ${missing.join(', ')}`);
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || rootDir,
    env: options.env || process.env,
    stdio: options.stdio || 'inherit',
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  return result;
}

function capture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || rootDir,
    env: options.env || process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    throw new Error(stderr || `${command} ${args.join(' ')} failed.`);
  }

  return (result.stdout || '').trim();
}

function logStep(message) {
  console.log(`\n▶  ${message}`);
}

function logOk(message) {
  console.log(`   ✓  ${message}`);
}

function isUnsetArtifactBucket(value) {
  return !value || value === 'your-artifacts-bucket';
}

function getAccountId(region) {
  return capture('aws', [
    'sts',
    'get-caller-identity',
    '--query',
    'Account',
    '--output',
    'text',
    '--region',
    region,
  ]);
}

function resolveArtifactBucket(values, deployEnvironment, region) {
  if (!isUnsetArtifactBucket(values.LAMBDA_CODE_S3_BUCKET)) {
    return values.LAMBDA_CODE_S3_BUCKET;
  }

  const accountId = getAccountId(region);
  return `estatesnearm-artifacts-${accountId}-${region}-${deployEnvironment}`;
}

function route53RecordExists(hostedZoneId, recordName, recordType) {
  const count = capture('aws', [
    'route53',
    'list-resource-record-sets',
    '--hosted-zone-id',
    hostedZoneId,
    '--query',
    `length(ResourceRecordSets[?Name=='${recordName}' && Type=='${recordType}'])`,
    '--output',
    'text',
  ]);

  return Number.parseInt(count, 10) > 0;
}

function autoSkipAmplifyDnsWhenRecordsExist(config) {
  if (!config.manageAmplifyRoute53Records || config.useExistingAmplifyApp) {
    return;
  }

  const apexRecord = `${config.rootDomain}.`;
  const wwwRecord = `www.${config.rootDomain}.`;
  const apexExists = route53RecordExists(config.ROUTE53_HOSTED_ZONE_ID, apexRecord, 'A');
  const wwwExists = route53RecordExists(config.ROUTE53_HOSTED_ZONE_ID, wwwRecord, 'CNAME');

  if (!apexExists && !wwwExists) {
    return;
  }

  logStep('Existing Route 53 records detected; auto-skipping Amplify DNS record creation...');

  if (apexExists) {
    console.log(`   •  Found existing A record: ${apexRecord}`);
  }

  if (wwwExists) {
    console.log(`   •  Found existing CNAME record: ${wwwRecord}`);
  }

  config.manageAmplifyRoute53Records = false;
  logOk('CloudFormation will skip creating apex/www Amplify Route 53 records.');
}

function validateAmplifyGitHubToken(token) {
  const trimmed = (token || '').trim();

  if (trimmed.startsWith('github_pat_')) {
    throw new Error(
      'AMPLIFY_GITHUB_TOKEN appears to be a GitHub fine-grained token (github_pat_*). '
      + 'Amplify repository setup can fail with 403 webhook errors when using fine-grained tokens. '
      + 'Use a GitHub PAT classic token (ghp_*) with repo and admin:repo_hook scopes, '
      + 'then re-run deploy.',
    );
  }
}

function buildConfig(target, cliRegion) {
  const { envFilePath, values } = loadDeploymentEnv(target);
  const deployEnvironment = values.DEPLOY_ENVIRONMENT || (target === 'development' ? 'staging' : target);
  const region = cliRegion || values.AWS_REGION || 'us-east-1';
  const rootDomain = values.ROOT_DOMAIN || 'findingestates.com';
  const stackName = values.STACK_NAME || `estatesnearm-${deployEnvironment}`;
  const branch = values.GITHUB_BRANCH || 'main';
  const useExistingAmplifyApp = values.USE_EXISTING_AMPLIFY_APP === 'true';
  const existingAmplifyAppId = values.EXISTING_AMPLIFY_APP_ID || '';
  const existingAmplifyDefaultDomain = values.EXISTING_AMPLIFY_DEFAULT_DOMAIN || '';
  const manageAmplifyRoute53Records = values.MANAGE_AMPLIFY_ROUTE53_RECORDS !== 'false';
  const createApexAmplifyAlias = values.CREATE_APEX_AMPLIFY_ALIAS === 'true';
  const createDynamoDBTables = values.CREATE_DYNAMODB_TABLES !== 'false';
  const existingUsersTableName = values.EXISTING_USERS_TABLE_NAME || '';
  const existingSalesTableName = values.EXISTING_SALES_TABLE_NAME || '';
  const createAPIGatewayCustomDomain = values.CREATE_API_GATEWAY_CUSTOM_DOMAIN !== 'false';
  const existingAPIGatewayDomainName = values.EXISTING_API_GATEWAY_DOMAIN_NAME || '';
  const existingAPIGatewayRegionalDomainName = values.EXISTING_API_GATEWAY_REGIONAL_DOMAIN_NAME || '';
  const existingAPIGatewayRegionalHostedZoneId = values.EXISTING_API_GATEWAY_REGIONAL_HOSTED_ZONE_ID || '';
  const createSSMParameters = values.CREATE_SSM_PARAMETERS !== 'false';
  const lambdaCodeBucket = resolveArtifactBucket(values, deployEnvironment, region);
  const lambdaCodeKey = values.LAMBDA_CODE_S3_KEY || `backend/lambda-${deployEnvironment}.zip`;

  const config = {
    ...values,
    target,
    envFilePath,
    deployEnvironment,
    region,
    rootDomain,
    stackName,
    branch,
    useExistingAmplifyApp,
    existingAmplifyAppId,
    existingAmplifyDefaultDomain,
    manageAmplifyRoute53Records,
    createApexAmplifyAlias,
    createDynamoDBTables,
    existingUsersTableName,
    existingSalesTableName,
    createAPIGatewayCustomDomain,
    existingAPIGatewayDomainName,
    existingAPIGatewayRegionalDomainName,
    existingAPIGatewayRegionalHostedZoneId,
    createSSMParameters,
    lambdaCodeBucket,
    lambdaCodeKey,
  };

  const requiredKeys = [
    'JWT_SECRET',
    'ADMIN_EMAIL',
    'ROUTE53_HOSTED_ZONE_ID',
  ];

  if (config.useExistingAmplifyApp) {
    requiredKeys.push('EXISTING_AMPLIFY_APP_ID', 'EXISTING_AMPLIFY_DEFAULT_DOMAIN');
  } else {
    requiredKeys.push('GITHUB_REPO_URL', 'AMPLIFY_GITHUB_TOKEN');
  }

  if (!config.createDynamoDBTables) {
    requiredKeys.push('EXISTING_USERS_TABLE_NAME', 'EXISTING_SALES_TABLE_NAME');
  }

  ensureRequired(config, requiredKeys);

  if (config.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters.');
  }

  if (!config.useExistingAmplifyApp) {
    validateAmplifyGitHubToken(config.AMPLIFY_GITHUB_TOKEN);
  }

  return config;
}

function packageBackend() {
  logStep('Packaging backend for Lambda...');

  run('npm', ['install', '--omit=dev', '--workspaces=false'], { cwd: backendDir });

  const zipPath = path.join(os.tmpdir(), `enm-lambda-${Date.now()}.zip`);
  run('zip', ['-qr', zipPath, '.'], { cwd: backendDir });

  logOk(`Created Lambda artifact at ${zipPath}`);
  return zipPath;
}

function ensureArtifactBucket(config) {
  logStep('Ensuring Lambda artifact bucket exists...');

  const headBucket = spawnSync('aws', [
    's3api',
    'head-bucket',
    '--bucket',
    config.lambdaCodeBucket,
    '--region',
    config.region,
  ], {
    cwd: rootDir,
    env: process.env,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (headBucket.status === 0) {
    logOk(`Using existing bucket ${config.lambdaCodeBucket}`);
    return;
  }

  const createArgs = [
    's3api',
    'create-bucket',
    '--bucket',
    config.lambdaCodeBucket,
    '--region',
    config.region,
  ];

  if (config.region !== 'us-east-1') {
    createArgs.push(
      '--create-bucket-configuration',
      `LocationConstraint=${config.region}`,
    );
  }

  run('aws', createArgs);
  run('aws', [
    's3api',
    'put-bucket-versioning',
    '--bucket',
    config.lambdaCodeBucket,
    '--versioning-configuration',
    'Status=Enabled',
    '--region',
    config.region,
  ]);
  run('aws', [
    's3api',
    'put-bucket-encryption',
    '--bucket',
    config.lambdaCodeBucket,
    '--server-side-encryption-configuration',
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}',
    '--region',
    config.region,
  ]);
  run('aws', [
    's3api',
    'put-public-access-block',
    '--bucket',
    config.lambdaCodeBucket,
    '--public-access-block-configuration',
    'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true',
    '--region',
    config.region,
  ]);

  logOk(`Created artifact bucket ${config.lambdaCodeBucket}`);
}

function uploadArtifact(zipPath, config) {
  logStep('Uploading Lambda artifact to S3...');

  run('aws', [
    's3',
    'cp',
    zipPath,
    `s3://${config.lambdaCodeBucket}/${config.lambdaCodeKey}`,
    '--region',
    config.region,
  ]);

  logOk(`Uploaded to s3://${config.lambdaCodeBucket}/${config.lambdaCodeKey}`);
}

function deployCloudFormation(config) {
  logStep('Deploying CloudFormation stack...');
  console.log('   •  ACM certificate validation via Route 53 is automatic.');
  console.log('   •  First deploy can take 10–15 minutes.');

  run('aws', [
    'cloudformation',
    'deploy',
    '--template-file',
    'infrastructure/cloudformation.yml',
    '--stack-name',
    config.stackName,
    '--region',
    config.region,
    '--capabilities',
    'CAPABILITY_NAMED_IAM',
    '--parameter-overrides',
    `Environment=${config.deployEnvironment}`,
    `LambdaCodeS3Bucket=${config.lambdaCodeBucket}`,
    `LambdaCodeS3Key=${config.lambdaCodeKey}`,
    `JwtSecret=${config.JWT_SECRET}`,
    `GoogleMapsApiKey=${config.REACT_APP_GOOGLE_MAPS_API_KEY || ''}`,
    `AdminEmail=${config.ADMIN_EMAIL}`,
    `RootDomain=${config.rootDomain}`,
    `Route53HostedZoneId=${config.ROUTE53_HOSTED_ZONE_ID}`,
    `GitHubRepoUrl=${config.GITHUB_REPO_URL || 'https://github.com/placeholder/placeholder'}`,
    `GitHubBranch=${config.branch}`,
    `AmplifyGitHubToken=${config.AMPLIFY_GITHUB_TOKEN || 'unused-when-reusing-amplify'}`,
    `UseExistingAmplifyApp=${config.useExistingAmplifyApp ? 'true' : 'false'}`,
    `ExistingAmplifyAppId=${config.existingAmplifyAppId}`,
    `ExistingAmplifyDefaultDomain=${config.existingAmplifyDefaultDomain}`,
    `ManageAmplifyRoute53Records=${config.manageAmplifyRoute53Records ? 'true' : 'false'}`,
    `CreateApexAmplifyAlias=${config.createApexAmplifyAlias ? 'true' : 'false'}`,
    `CreateDynamoDBTables=${config.createDynamoDBTables ? 'true' : 'false'}`,
    `ExistingUsersTableName=${config.existingUsersTableName}`,
    `ExistingSalesTableName=${config.existingSalesTableName}`,
    `CreateAPIGatewayCustomDomain=${config.createAPIGatewayCustomDomain ? 'true' : 'false'}`,
    `ExistingAPIGatewayDomainName=${config.existingAPIGatewayDomainName}`,
    `ExistingAPIGatewayRegionalDomainName=${config.existingAPIGatewayRegionalDomainName}`,
    `ExistingAPIGatewayRegionalHostedZoneId=${config.existingAPIGatewayRegionalHostedZoneId}`,
    `CreateSSMParameters=${config.createSSMParameters ? 'true' : 'false'}`,
    '--no-fail-on-empty-changeset',
  ]);

  logOk('CloudFormation deployed.');
}

function getOutput(config, key) {
  return capture('aws', [
    'cloudformation',
    'describe-stacks',
    '--stack-name',
    config.stackName,
    '--region',
    config.region,
    '--query',
    `Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue`,
    '--output',
    'text',
  ]);
}

function readOutputs(config) {
  logStep('Reading stack outputs...');

  const outputs = {
    amplifyAppId: getOutput(config, 'AmplifyAppId'),
    frontendUrl: getOutput(config, 'FrontendURL'),
    apiUrl: getOutput(config, 'APIURL'),
    cognitoPool: getOutput(config, 'CognitoUserPoolId'),
    cognitoClient: getOutput(config, 'CognitoClientId'),
    lambdaName: getOutput(config, 'BackendLambdaName'),
    uploadsBucket: getOutput(config, 'UploadsBucketName'),
    certificateArn: getOutput(config, 'CertificateArn'),
  };

  logOk(`Frontend URL:    ${outputs.frontendUrl}`);
  logOk(`API URL:         ${outputs.apiUrl}`);
  logOk(`Cognito Pool:    ${outputs.cognitoPool}`);
  logOk(`Lambda:          ${outputs.lambdaName}`);

  return outputs;
}

function triggerAmplify(outputs, config) {
  logStep(`Triggering Amplify build for branch: ${config.branch}...`);

  if (!outputs.amplifyAppId || outputs.amplifyAppId === 'None') {
    console.log('   ⚠  Amplify App ID not found. Trigger the build manually in the AWS console.');
    return;
  }

  const jobId = capture('aws', [
    'amplify',
    'start-job',
    '--app-id',
    outputs.amplifyAppId,
    '--branch-name',
    config.branch,
    '--job-type',
    'RELEASE',
    '--region',
    config.region,
    '--query',
    'jobSummary.jobId',
    '--output',
    'text',
  ]);

  logOk(`Amplify build started — Job ID: ${jobId}`);
}

function printSummary(config, outputs) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅  Deployment triggered');
  console.log('');
  console.log(`  Env file:              ${path.basename(config.envFilePath)}`);
  console.log(`  Stack:                 ${config.stackName}`);
  console.log(`  Frontend URL:          ${outputs.frontendUrl}`);
  console.log(`  API URL:               ${outputs.apiUrl}`);
  console.log(`  Cognito Pool:          ${outputs.cognitoPool}`);
  console.log(`  Backend Lambda:        ${outputs.lambdaName}`);
  console.log(`  Uploads Bucket:        ${outputs.uploadsBucket}`);
  console.log(`  ACM Certificate:       ${outputs.certificateArn}`);
  console.log('');
  console.log('  Next steps:');
  console.log(`  1. Watch Lambda logs: aws logs tail /aws/lambda/${outputs.lambdaName} --follow --region ${config.region}`);
  console.log(`  2. Re-run npm run deploy:${config.target} after backend changes`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

function main() {
  const [targetArg, cliRegion] = process.argv.slice(2);

  if (!targetArg || targetArg === '--help' || targetArg === '-h') {
    printUsage();
    process.exit(targetArg ? 0 : 1);
  }

  if (!['production', 'development'].includes(targetArg)) {
    throw new Error(`Unsupported deploy target: ${targetArg}`);
  }

  const config = buildConfig(targetArg, cliRegion);
  autoSkipAmplifyDnsWhenRecordsExist(config);

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  EstatesNearMe deploy');
  console.log(`  Target      : ${config.target}`);
  console.log(`  Stack env   : ${config.deployEnvironment}`);
  console.log(`  Region      : ${config.region}`);
  console.log(`  Stack       : ${config.stackName}`);
  console.log(`  Domain      : ${config.rootDomain}`);
  console.log(`  Branch      : ${config.branch}`);
  console.log(`  Manage DNS  : ${config.manageAmplifyRoute53Records ? 'yes' : 'no (apex/www skipped)'}`);
  console.log(`  Env file    : ${path.basename(config.envFilePath)}`);
  console.log(`  Lambda ZIP  : s3://${config.lambdaCodeBucket}/${config.lambdaCodeKey}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const zipPath = packageBackend();

  try {
    ensureArtifactBucket(config);
    uploadArtifact(zipPath, config);
    deployCloudFormation(config);
    const outputs = readOutputs(config);
    triggerAmplify(outputs, config);
    printSummary(config, outputs);
  } finally {
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
  }
}

try {
  main();
} catch (error) {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
}
