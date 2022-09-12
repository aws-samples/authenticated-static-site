#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { addSARMetadata } from "../lib/metadata-util";
import { PublishedAuthenticatedStaticSiteStack } from "../lib/published-authenticated-static-site-stack";

const app = new cdk.App();

const stack = new PublishedAuthenticatedStaticSiteStack(
  app,
  "AuthenticatedStaticSiteStack",
  {
    bucketName: undefined, // name must be uniq
  }
);

addSARMetadata(stack);
