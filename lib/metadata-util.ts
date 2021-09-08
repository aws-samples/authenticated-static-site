import * as cdk from "@aws-cdk/core";

export function addSARMetadata(stack: cdk.Stack) {
  const metadata = {
    "AWS::ServerlessRepo::Application": {
      Name: "AuthenticatedStaticSite",
      Description:
        "Publish content of a GitHub repo to a static site hosted on S3/CloudFront and enforce Cognito authentciation to access it.",
      Author: "Otto Kruse, Jerome Pasini",
      LicenseUrl: "LICENSE.txt",
      ReadmeUrl: "README.md",
      SemanticVersion: "0.0.1",
      SourceCodeUrl:
        "https://gitlab.aws.dev/authenticated-static-site/authenticated-static-site",
    },
  };
  stack.templateOptions.metadata = metadata;
}
