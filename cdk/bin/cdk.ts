import * as cdk from 'aws-cdk-lib';
import { RelicStack } from '../lib/relic-stack';

const app = new cdk.App();

new RelicStack(app, 'RelicStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
});
