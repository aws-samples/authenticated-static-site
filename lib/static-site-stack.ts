import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import * as cloudfront from "@aws-cdk/aws-cloudfront";
import * as origins from "@aws-cdk/aws-cloudfront-origins";
import * as iam from "@aws-cdk/aws-iam";
import { PriceClass } from "@aws-cdk/aws-cloudfront";

export interface StaticSiteStackProps extends cdk.StackProps {
  bucketName?: string;
}

export abstract class StaticSiteStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: cdk.Construct, id: string, props?: StaticSiteStackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, "StaticSiteBucket", {
      bucketName: props?.bucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // not for Production !
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      "StaticSiteOrigin"
    );

    this.distribution = new cloudfront.Distribution(this, "StaticSite", {
      defaultBehavior: {
        origin: new origins.S3Origin(this.bucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: "index.html",
      errorResponses: [{ httpStatus: 404, responsePagePath: "/notfound.html" }],
      priceClass: PriceClass.PRICE_CLASS_100, // reduce cost by using only USA and EU edges nodes
    });

    // We'll allow the Origin Access Identity the ListBucket privilege,
    // so that accessing a non-existent object raises 404 instead of 403
    this.bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:ListBucket"],
        principals: [originAccessIdentity.grantPrincipal],
        resources: [this.bucket.bucketArn],
      })
    );

    // Allow object access too
    // CDK would do this automatically if we did not manually allow s3:ListBucket above
    this.bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:GetObject"],
        principals: [originAccessIdentity.grantPrincipal],
        resources: [this.bucket.arnForObjects("*")],
      })
    );

    new cdk.CfnOutput(this, "CloudFrontURL", {
      value: "https://" + this.distribution.distributionDomainName,
      description: "The path of the site",
      exportName: "CloudFrontURL",
    });
  }
}
