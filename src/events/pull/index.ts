import { Context } from "probot";
import PullRequestFormatService from "../../services/pr-format";
import { PullRequestFormatQuery } from "../../queries/PullRequestFormatQuery";
import { PullRequestFileQuery } from "../../queries/PullRequestFileQuery";
import {
  Config,
  DEFAULT_CONFIG_FILE_PATH,
  DEFAULT_SIG_MEMBERS_FILE_NAME,
} from "../../config/Config";
import Ajv from "ajv";

import sigSchema from "../../config/sig.members.schema.json";
import { Status } from "../../services/reply";
import { combineReplay } from "../../services/utils/ReplyUtil";

const ajv = Ajv();
const validate = ajv.compile(sigSchema);

enum PullRequestActions {
  Opened = "opened",
  Edited = "edited",
  Labeled = "labeled",
  Unlabeled = "unlabeled",
  Closed = "closed",
  Reopened = "reopened",
}

const handleFormat = async (
  context: Context,
  pullRequestFormatService: PullRequestFormatService
) => {
  const { head, number } = context.payload.pull_request;

  const { data: filesData } = await context.github.pulls.listFiles({
    ...context.issue(),
    pull_number: number,
  });

  const files: PullRequestFileQuery[] = filesData.map((f) => {
    return {
      ...f,
    };
  });

  const config = await context.config<Config>(DEFAULT_CONFIG_FILE_PATH);

  const pullRequestFormatQuery: PullRequestFormatQuery = {
    sigFileName: config?.sigMembersFileName || DEFAULT_SIG_MEMBERS_FILE_NAME,
    files,
  };

  const reply = await pullRequestFormatService.formatting(
    validate,
    pullRequestFormatQuery
  );

  const status = {
    sha: head.sha,
    state: reply.status === Status.Success ? "success" : "failure",
    target_url: "https://github.com/tidb-community-bots/ti-community-bot",
    description: reply.message,
    context: "Sig File Format",
  };

  switch (reply.status) {
    case Status.Failed: {
      // TODO: add log.
      await context.github.issues.createComment(
        context.issue({ body: reply.message })
      );
      // @ts-ignore
      await context.github.repos.createStatus({
        ...context.repo(),
        ...status,
      });
      break;
    }
    case Status.Success: {
      // @ts-ignore
      await context.github.repos.createStatus({
        ...context.repo(),
        ...status,
      });
      break;
    }
    case Status.Problematic: {
      await context.github.issues.createComment(
        context.issue({ body: combineReplay(reply) })
      );
      // @ts-ignore
      await context.github.repos.createStatus({
        ...context.repo(),
        ...status,
      });
      break;
    }
  }
};

const handlePullRequestEvents = async (
  context: Context,
  pullRequestFormatService: PullRequestFormatService
) => {
  switch (context.payload.action) {
    case PullRequestActions.Closed: {
      break;
    }
    case PullRequestActions.Labeled: {
      break;
    }
    case PullRequestActions.Unlabeled: {
      break;
    }
    default: {
      await handleFormat(context, pullRequestFormatService);
      break;
    }
  }
};

export default handlePullRequestEvents;