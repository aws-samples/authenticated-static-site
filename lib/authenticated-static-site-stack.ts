import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import {
  aws_cognito as cognito,
} from "aws-cdk-lib";
import { deployAuthorizationAtEdge } from "./authorization-at-edge-util";
import { StaticSiteStack, StaticSiteStackProps } from "./static-site-stack";

export abstract class AuthenticatedStaticSiteStack extends StaticSiteStack {
  constructor(scope: Construct, id: string, props?: StaticSiteStackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, "UserPool", {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // not for Production !
    });

    const userPoolClient = userPool.addClient("LambdaAtEdge", {
      generateSecret: true,
      oAuth: {
        callbackUrls: ["https://example.com/will-be-replaced"], // will be replaced later with actual CloudFront URL
        flows: {
          authorizationCodeGrant: true,
        },
      },
    });
    const userPoolDomain = userPool.addDomain("HostedUI", {
      cognitoDomain: {
        domainPrefix: `auth-${cdk.Fn.select(
          2,
          cdk.Fn.split("/", this.stackId)
        )}`,
      },
    });

    deployAuthorizationAtEdge(this, {
      cloudFrontDistribution: this.distribution,
      enableSPAMode: false,
      oAuthScopes: [
        "profile",
        "phone",
        "email",
        "openid",
        "aws.cognito.signin.user.admin",
      ],
      userPool,
      userPoolClient,
      userPoolDomain,
      paths: {
        redirectPathSignIn: "/parseauth", // handles the redirect with auth code from Cognito
        redirectPathAuthRefresh: "/refreshauth", // handles refreshes using refresh token (automatic)
        signOutUrl: "/signout", // if you navigate to this URL, you will be signed out
        redirectPathSignOut: "/", // after signing out, this is where Cognito will redirect you to
      },
      redirectSlashToIndexHtml: true, // if a user goes to /folder/subfolder/ we'll map that to /folder/subfolder/index.html on S3
    });
  }
}
