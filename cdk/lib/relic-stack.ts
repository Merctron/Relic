import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class RelicStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Minimal VPC: single public subnet, no NAT (outbound only)
    const vpc = new ec2.Vpc(this, 'RelicVpc', {
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });

    const sg = new ec2.SecurityGroup(this, 'RelicSg', {
      vpc,
      description: 'Relic automation host',
      allowAllOutbound: true,
    });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'SSH');

    const role = new iam.Role(this, 'RelicInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    const keyPair = new ec2.KeyPair(this, 'RelicKeyPair', {
      keyPairName: 'relic-keypair',
    });

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      // System packages
      'dnf install -y git cronie rsync',
      'systemctl enable --now crond',

      // NVM + Node for ec2-user
      'su - ec2-user -c "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"',
      'su - ec2-user -c "source ~/.nvm/nvm.sh && nvm install 20 && nvm alias default 20"',

      // Relic home directory — config and assets are deployed separately via scripts/deploy
      'mkdir -p /home/ec2-user/.relic',
      'chown -R ec2-user:ec2-user /home/ec2-user/.relic',
    );

    const instance = new ec2.Instance(this, 'RelicInstance', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: sg,
      role,
      keyPair,
      userData,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // Pin logical ID to prevent replacement on CDK drift
    (instance.node.defaultChild as ec2.CfnInstance).overrideLogicalId('RelicInstance');

    new cdk.CfnOutput(this, 'InstancePublicIp', {
      value: instance.instancePublicIp,
      description: 'SSH target: ssh -i relic.pem ec2-user@<ip>',
    });

    new cdk.CfnOutput(this, 'SshKeyParameterName', {
      value: keyPair.privateKey.parameterName,
      description: 'SSM parameter holding the private key — retrieve with scripts/get-key',
    });
  }
}
