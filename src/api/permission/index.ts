import { PermissionService } from "../../services/permission";
import { Request, Response } from "express";
import { ProbotOctokit } from "probot/lib/octokit/probot-octokit";
import { PullFileQuery } from "../../queries/PullFileQuery";
import { PullPermissionQuery } from "../../queries/PullPermissionQuery";
import {
  Config,
  DEFAULT_CONFIG_FILE_PATH,
  DEFAULT_SIG_INFO_FILE_NAME,
} from "../../config/Config";
import { config } from "../../services/utils/ConfigUtil";
import { ContributorSchema } from "../../config/SigInfoSchema";

const listPermissions = async (
  req: Request,
  res: Response,
  permissionService: PermissionService,
  github: InstanceType<typeof ProbotOctokit>
) => {
  const owner = req.params.owner;
  const repo = req.params.repo;
  const pullNumber = Number(req.params.number);

  const { data: filesData } = await github.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
  });

  const files: PullFileQuery[] = filesData.map((f) => {
    return {
      ...f,
    };
  });

  const repoConfig = await config<Config>(
    owner,
    repo,
    DEFAULT_CONFIG_FILE_PATH,
    github
  );

  // TODO: need response.
  if (repoConfig === null) {
    return;
  }

  const { data: maintainerInfos } = await github.teams.listMembersInOrg({
    org: owner,
    team_slug: repoConfig.maintainerTeamSlug,
  });
  const maintainers: ContributorSchema[] = maintainerInfos.map((m) => {
    return {
      githubId: m.login,
    };
  });

  const { data: collaboratorInfos } = await github.repos.listCollaborators({
    owner,
    repo,
  });
  const collaborators = collaboratorInfos.map((c) => {
    return {
      githubId: c.login,
    };
  });

  const pullPermissionQuery: PullPermissionQuery = {
    sigInfoFileName: repoConfig.sigInfoFileName || DEFAULT_SIG_INFO_FILE_NAME,
    maintainers,
    collaborators,
    files,
  };

  const response = await permissionService.listPermissions(pullPermissionQuery);

  res.status(response.status);
  res.json(response);
};

export default listPermissions;