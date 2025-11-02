export interface SuggestedFix {
  fileName: string;
  description: string;
  suggestedCode: string;
}

export interface DeploymentPlan {
  projectType: string;
  renderYaml: string;
  buildCommand: string;
  startCommand: string;
  explanation: string;
  suggestedFixes: SuggestedFix[];
}

export interface ProjectData {
  replitConfig: string;
  packageJson?: string;
  otherConfigs: { [key: string]: string };
  files: string[];
  allFileContents: { [key: string]: string };
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
  html_url: string;
}

export interface RenderOwner {
    id: string;
    name: string;
    email: string;
    type: 'user' | 'team';
}

export interface RenderService {
    id: string;
    name: string;
    type: string;
    serviceDetails: {
        url?: string;
    };
}

export interface RenderDeploy {
    id: string;
    status: string;
}

export interface RenderBlueprint {
    blueprint: {
        id: string;
        name: string;
        repo: string;
    };
    deploy: RenderDeploy;
    services: RenderService[];
}