import { Template, } from "aws-cdk-lib/assertions";
import * as cdk from "aws-cdk-lib";
import { PublishedAuthenticatedStaticSiteStack } from "../lib/published-authenticated-static-site-stack";

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new PublishedAuthenticatedStaticSiteStack(
      app,
      "AuthenticatedStaticSiteStack",
      {
        bucketName: undefined, // name must be uniq
      }
    );
    // THEN
    expect(Template.fromStack(stack)).toMatchSnapshot();
});
