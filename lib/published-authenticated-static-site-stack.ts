
import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import {
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as codepipelineActions,
  aws_codebuild as codebuild,
  aws_iam as iam,
} from "aws-cdk-lib";

import * as fs from "fs";
import * as path from "path";
import { StaticSiteStackProps } from "./static-site-stack";
import { AuthenticatedStaticSiteStack } from "./authenticated-static-site-stack";

export class PublishedAuthenticatedStaticSiteStack extends AuthenticatedStaticSiteStack {
  constructor(scope: Construct, id: string, props: StaticSiteStackProps) {
    super(scope, id, props);

    const sourceOutput = new codepipeline.Artifact();

    const invalidateCacheBuildProject = new codebuild.PipelineProject(
      this,
      `InvalidateProject`,
      {
        buildSpec: codebuild.BuildSpec.fromObject({
          version: "0.2",
          phases: {
            build: {
              commands: [
                'aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_ID} --paths "/*"',
              ],
            },
          },
        }),
        environmentVariables: {
          CLOUDFRONT_ID: { value: this.distribution.distributionId },
        },
        environment: {
          buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3,
        },
      }
    );

    const deleteOldFilesScript = fs
      .readFileSync(path.join(__dirname, "delete-old-files.sh"), {
        encoding: "utf8",
      })
      .replace(/'/g, "'\\''"); // escape single quotes as we'll echo this to a file, see below

    const deleteOldFilesBuildProject = new codebuild.PipelineProject(
      this,
      `DeleteOldFilesProject`,
      {
        buildSpec: codebuild.BuildSpec.fromObjectToYaml({
          version: "0.2",
          phases: {
            build: {
              commands: [
                `echo '${deleteOldFilesScript}' > ./delete-old-files.sh`,
                "chmod +x ./delete-old-files.sh",
                "./delete-old-files.sh",
              ],
            },
          },
        }),
        environmentVariables: {
          S3_BUCKET_NAME: { value: this.bucket.bucketName },
        },
        environment: {
          buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3,
        },
      }
    );
    this.bucket.grantReadWrite(deleteOldFilesBuildProject);

    // Add Cloudfront invalidation permissions to the project
    const distributionArn = `arn:aws:cloudfront::${this.account}:distribution/${this.distribution.distributionId}`;
    invalidateCacheBuildProject.addToRolePolicy(
      new iam.PolicyStatement({
        resources: [distributionArn],
        actions: ["cloudfront:CreateInvalidation"],
      })
    );

    const gitHubOwner = new cdk.CfnParameter(this, "GitHubOwner", {
      type: "String",
      description: "The name of the GitHub repo owner.",
    });

    const gitHubRepo = new cdk.CfnParameter(this, "GitHubRepo", {
      type: "String",
      description: "The name of the GitHub repository.",
    });

    const gitHubBranch = new cdk.CfnParameter(this, "GitHubBranch", {
      type: "String",
      description: "The name of the GitHub branch.",
    });

    const gitHubConnectionARN = new cdk.CfnParameter(
      this,
      "GitHubConnectionARN",
      {
        type: "String",
        description: "The name of the GitHub Connection ARN in AWS Code Suite.",
      }
    );

    const pipeline = new codepipeline.Pipeline(this, "StaticSitePipeline", {
      pipelineName: "StaticSiteUpdatePipeline",
      crossAccountKeys: false,
      stages: [
        {
          stageName: "Source",
          actions: [
            new codepipelineActions.CodeStarConnectionsSourceAction({
              actionName: "GitHub_Site_Content_Source",
              owner: gitHubOwner.valueAsString,
              repo: gitHubRepo.valueAsString,
              branch: gitHubBranch.valueAsString,
              connectionArn: gitHubConnectionARN.valueAsString,
              output: sourceOutput,
              runOrder: 1,
            }),
          ],
        },
        {
          stageName: "Deploy",
          actions: [
            new codepipelineActions.S3DeployAction({
              actionName: "S3Deploy",
              bucket: this.bucket,
              input: sourceOutput,
              runOrder: 1,
            }),
            new codepipelineActions.CodeBuildAction({
              actionName: "DeleteOldFilesFromS3",
              project: deleteOldFilesBuildProject,
              input: sourceOutput,
              runOrder: 2,
            }),
            new codepipelineActions.CodeBuildAction({
              actionName: "InvalidateCloudFrontCache",
              project: invalidateCacheBuildProject,
              input: sourceOutput,
              runOrder: 3,
            }),
          ],
        },
      ],
    });
  }
}
