/**
 * Helper utility to make it easy to deploy SAR-app cloudfront-authorization-at-edge from CDK
 * against a CloudFront distribution and Cognito User Pool created in CDK
 */

import { IConstruct } from "constructs";
import * as cdk from "aws-cdk-lib";
import {
  aws_sam as sam,
  aws_cognito as cognito,
  aws_lambda as lambda,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
} from "aws-cdk-lib";

interface AuthEdgeprops {
  cloudFrontDistribution: cloudfront.Distribution;
  userPool: cognito.IUserPool;
  userPoolClient: cognito.IUserPoolClient;
  userPoolDomain: cognito.IUserPoolDomain;
  paths: {
    redirectPathAuthRefresh: string;
    redirectPathSignOut: string;
    signOutUrl: string;
    redirectPathSignIn: string;
  };
  oAuthScopes: string[];
  enableSPAMode: boolean;
  redirectSlashToIndexHtml: boolean;
}

export function deployAuthorizationAtEdge(
  stack: cdk.Stack,
  props: AuthEdgeprops
) {
  const authAtEdge = new sam.CfnApplication(stack, "AuthorizationAtEdge", {
    location: {
      applicationId:
        "arn:aws:serverlessrepo:us-east-1:520945424137:applications/cloudfront-authorization-at-edge",
      semanticVersion: "2.0.12",
    },
    parameters: {
      CreateCloudFrontDistribution: "false",
      UserPoolArn: props.userPool.userPoolArn,
      UserPoolClientId: props.userPoolClient.userPoolClientId,
      EnableSPAMode: props.enableSPAMode?.toString(),
      OAuthScopes: props.oAuthScopes.join(","),
      RedirectPathAuthRefresh: props.paths.redirectPathAuthRefresh,
      RedirectPathSignIn: props.paths.redirectPathSignIn,
      SignOutUrl: props.paths.signOutUrl,
      Version: "2.0.12",
    },
  });
  authAtEdge.node.addDependency(props.userPoolDomain); // authorization-at-edge requires the domain to be created

  const checkAuthHandler = lambda.Version.fromVersionArn(
    stack,
    "CheckAuthHandler",
    authAtEdge.getAtt("Outputs.CheckAuthHandler").toString()
  );
  const parseAuthHandler = lambda.Version.fromVersionArn(
    stack,
    "ParseAuthHandler",
    authAtEdge.getAtt("Outputs.ParseAuthHandler").toString()
  );
  const signOutHandler = lambda.Version.fromVersionArn(
    stack,
    "SignOutHandler",
    authAtEdge.getAtt("Outputs.SignOutHandler").toString()
  );
  const refreshAuthHandler = lambda.Version.fromVersionArn(
    stack,
    "RefreshAuthHandler",
    authAtEdge.getAtt("Outputs.RefreshAuthHandler").toString()
  );
  const trailingSlashHandler = lambda.Version.fromVersionArn(
    stack,
    "TrailingSlashHandler",
    authAtEdge.getAtt("Outputs.TrailingSlashHandler").toString()
  );

  new cdk.CustomResource(stack, "RedirectUriUpdates", {
    serviceToken: authAtEdge
      .getAtt("Outputs.UserPoolClientUpdateHandler")
      .toString(),
    properties: {
      UserPoolArn: props.userPool.userPoolArn,
      UserPoolClientId: props.userPoolClient.userPoolClientId,
      CloudFrontDistributionDomainName: props.cloudFrontDistribution.domainName,
      RedirectPathSignIn: props.paths.redirectPathSignIn,
      RedirectPathSignOut: props.paths.redirectPathSignOut,
      AlternateDomainNames: "",
      OAuthScopes: props.oAuthScopes,
    },
  });

  // Change default behavior of the CloudFront distribution to include Auth
  const lambdaEdgeAssociations = [
    {
      eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
      lambdaFunctionARN: checkAuthHandler.functionArn,
    },
  ];
  if (props.redirectSlashToIndexHtml) {
    lambdaEdgeAssociations.push({
      eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
      lambdaFunctionARN: trailingSlashHandler.functionArn,
    });
  }
  cdk.Aspects.of(props.cloudFrontDistribution).add(
    new AddLambdaEdgeToDefaultBehavior({
      lambdaEdgeAssociations,
    })
  );

  // Add behaviors for special Auth paths
  const dummyOrigin = new origins.HttpOrigin("example.com");

  props.cloudFrontDistribution.addBehavior(
    props.paths.redirectPathAuthRefresh,
    dummyOrigin,
    {
      edgeLambdas: [
        {
          eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
          functionVersion: refreshAuthHandler,
        },
      ],
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    }
  );

  props.cloudFrontDistribution.addBehavior(
    props.paths.redirectPathSignIn,
    dummyOrigin,
    {
      edgeLambdas: [
        {
          eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
          functionVersion: parseAuthHandler,
        },
      ],
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    }
  );

  props.cloudFrontDistribution.addBehavior(
    props.paths.signOutUrl,
    dummyOrigin,
    {
      edgeLambdas: [
        {
          eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
          functionVersion: signOutHandler,
        },
      ],
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    }
  );
}

class AddLambdaEdgeToDefaultBehavior implements cdk.IAspect {
  constructor(
    public props: {
      lambdaEdgeAssociations: {
        eventType: cloudfront.LambdaEdgeEventType;
        lambdaFunctionARN: string;
      }[];
    }
  ) {}
  public visit(node: IConstruct): void {
    if (node instanceof cloudfront.CfnDistribution) {
      node.addPropertyOverride(
        "DistributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations",
        this.props.lambdaEdgeAssociations.map((association) => ({
          EventType: association.eventType,
          LambdaFunctionARN: association.lambdaFunctionARN,
        }))
      );
    }
  }
}
