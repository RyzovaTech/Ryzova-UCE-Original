import type { CompatibilityRule } from '../types';
import type { Issue } from '../../analyzer/types';
import { readFile } from './shared';

function hasFile(ctx: import('../types').RuleContext, name: string): boolean {
  return ctx.detectedFiles.some((f) => f.path === name || f.path.endsWith('/' + name));
}

function hasPath(ctx: import('../types').RuleContext, prefix: string): boolean {
  return ctx.files.some((f) => f.path.startsWith(prefix));
}

export const kubernetesRules: CompatibilityRule[] = [
  {
    id: 'k8s-deployment-present',
    category: 'deployment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasDeployment = ctx.files.some(
        (f) => !f.isDirectory && /deployment\.ya?ml$/i.test(f.path)
      );
      const hasK8sDir = hasPath(ctx, 'k8s/') || hasPath(ctx, 'kubernetes/') || hasPath(ctx, 'manifests/');
      if (!hasDeployment && !hasK8sDir) return issues;
      if (!hasDeployment) {
        issues.push({
          id: 'k8s-deployment-missing',
          title: 'Kubernetes deployment.yaml not found',
          category: 'deployment',
          severity: 'warning',
          description: 'A Kubernetes directory was detected but no deployment.yaml exists.',
          reason: 'A Deployment manifest is required to run pods in Kubernetes.',
          recommendation: 'Add a deployment.yaml in the k8s/ directory.',
          affectedFile: 'k8s/deployment.yaml',
          detected: 'missing',
          expected: 'deployment.yaml',
          impact: 'No pod configuration is defined for Kubernetes.',
          suggestedAction: 'Create a deployment.yaml manifest.',
        });
      }
      return issues;
    },
  },
  {
    id: 'k8s-service-present',
    category: 'deployment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasDeployment = ctx.files.some(
        (f) => !f.isDirectory && /deployment\.ya?ml$/i.test(f.path)
      );
      const hasService = ctx.files.some(
        (f) => !f.isDirectory && /service\.ya?ml$/i.test(f.path)
      );
      if (!hasDeployment) return issues;
      if (!hasService) {
        issues.push({
          id: 'k8s-service-missing',
          title: 'Kubernetes service.yaml not found',
          category: 'deployment',
          severity: 'warning',
          description: 'A deployment.yaml was found but no service.yaml exists.',
          reason: 'A Service is needed to expose pods to network traffic.',
          recommendation: 'Add a service.yaml alongside the deployment.',
          affectedFile: 'k8s/service.yaml',
          detected: 'missing',
          expected: 'service.yaml',
          impact: 'Pods are not accessible within the cluster.',
          suggestedAction: 'Create a service.yaml manifest.',
        });
      }
      return issues;
    },
  },
  {
    id: 'k8s-ingress-present',
    category: 'deployment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasDeployment = ctx.files.some(
        (f) => !f.isDirectory && /deployment\.ya?ml$/i.test(f.path)
      );
      const hasIngress = ctx.files.some(
        (f) => !f.isDirectory && /ingress\.ya?ml$/i.test(f.path)
      );
      if (!hasDeployment) return issues;
      if (!hasIngress) {
        issues.push({
          id: 'k8s-ingress-missing',
          title: 'Kubernetes ingress.yaml not found',
          category: 'deployment',
          severity: 'info',
          description: 'A deployment was found but no ingress.yaml exists.',
          reason: 'An Ingress routes external HTTP traffic to services.',
          recommendation: 'Add an ingress.yaml for external access.',
          affectedFile: 'k8s/ingress.yaml',
          detected: 'missing',
          expected: 'ingress.yaml',
          impact: 'No external routing is configured.',
          suggestedAction: 'Create an ingress.yaml manifest.',
        });
      }
      return issues;
    },
  },
  {
    id: 'k8s-deployment-replicas',
    category: 'deployment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const deploymentFile = ctx.files.find(
        (f) => !f.isDirectory && /deployment\.ya?ml$/i.test(f.path)
      );
      if (!deploymentFile || !deploymentFile.content) return issues;
      const content = deploymentFile.content;
      if (/kind:\s*Deployment/i.test(content)) {
        const m = content.match(/replicas:\s*(\d+)/);
        if (m && Number(m[1]) < 2) {
          issues.push({
            id: 'k8s-single-replica',
            title: 'Kubernetes Deployment has fewer than 2 replicas',
            category: 'deployment',
            severity: 'warning',
            description: `Deployment specifies ${m[1]} replica(s).`,
            reason: 'A single replica has no high availability during rollouts.',
            recommendation: 'Set replicas to at least 2 for availability.',
            affectedFile: deploymentFile.path,
            detected: `${m[1]} replica(s)`,
            expected: '>=2 replicas',
            impact: 'Downtime during pod restarts.',
            suggestedAction: 'Increase replicas to 2 or more.',
          });
        }
        if (!m) {
          issues.push({
            id: 'k8s-no-replicas',
            title: 'Kubernetes Deployment missing replicas field',
            category: 'deployment',
            severity: 'info',
            description: 'Deployment does not specify a replicas count.',
            reason: 'Without replicas, the default is 1, which lacks HA.',
            recommendation: 'Add replicas: 2 or more.',
            affectedFile: deploymentFile.path,
            detected: 'not specified',
            expected: '>=2 replicas',
            impact: 'Default of 1 replica has no HA.',
            suggestedAction: 'Add replicas to the Deployment.',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'k8s-resource-limits',
    category: 'deployment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const deploymentFile = ctx.files.find(
        (f) => !f.isDirectory && /deployment\.ya?ml$/i.test(f.path)
      );
      if (!deploymentFile || !deploymentFile.content) return issues;
      const content = deploymentFile.content;
      if (/kind:\s*Deployment/i.test(content)) {
        if (!/resources\s*:/.test(content) || !/limits\s*:/.test(content)) {
          issues.push({
            id: 'k8s-no-resource-limits',
            title: 'Kubernetes Deployment missing resource limits',
            category: 'deployment',
            severity: 'warning',
            description: 'The Deployment does not define resource limits.',
            reason: 'Without limits, pods can consume unbounded resources.',
            recommendation: 'Add requests and limits for CPU and memory.',
            affectedFile: deploymentFile.path,
            detected: 'no limits',
            expected: 'CPU and memory limits',
            impact: 'Resource contention and scheduling issues.',
            suggestedAction: 'Add resource limits to the container spec.',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'k8s-liveness-readiness',
    category: 'deployment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const deploymentFile = ctx.files.find(
        (f) => !f.isDirectory && /deployment\.ya?ml$/i.test(f.path)
      );
      if (!deploymentFile || !deploymentFile.content) return issues;
      const content = deploymentFile.content;
      if (/kind:\s*Deployment/i.test(content)) {
        if (!/livenessProbe\s*:/.test(content)) {
          issues.push({
            id: 'k8s-no-liveness',
            title: 'Kubernetes Deployment missing liveness probe',
            category: 'deployment',
            severity: 'info',
            description: 'The Deployment does not define a livenessProbe.',
            reason: 'Liveness probes let Kubernetes restart unhealthy containers.',
            recommendation: 'Add a livenessProbe to the container spec.',
            affectedFile: deploymentFile.path,
            detected: 'no livenessProbe',
            expected: 'livenessProbe',
            impact: 'Unhealthy containers are not restarted automatically.',
            suggestedAction: 'Add a livenessProbe.',
          });
        }
        if (!/readinessProbe\s*:/.test(content)) {
          issues.push({
            id: 'k8s-no-readiness',
            title: 'Kubernetes Deployment missing readiness probe',
            category: 'deployment',
            severity: 'info',
            description: 'The Deployment does not define a readinessProbe.',
            reason: 'Readiness probes prevent traffic to unready pods.',
            recommendation: 'Add a readinessProbe to the container spec.',
            affectedFile: deploymentFile.path,
            detected: 'no readinessProbe',
            expected: 'readinessProbe',
            impact: 'Traffic may reach pods that are not ready.',
            suggestedAction: 'Add a readinessProbe.',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'helm-chart-present',
    category: 'deployment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasChart = hasFile(ctx, 'Chart.yaml');
      const hasValues = hasFile(ctx, 'values.yaml');
      if (!hasChart) return issues;
      if (!hasValues) {
        issues.push({
          id: 'helm-no-values',
          title: 'Helm chart missing values.yaml',
          category: 'deployment',
          severity: 'warning',
          description: 'Chart.yaml was found but values.yaml is missing.',
          reason: 'values.yaml provides default configuration for the chart.',
          recommendation: 'Add a values.yaml alongside Chart.yaml.',
          affectedFile: 'values.yaml',
          detected: 'missing',
          expected: 'values.yaml',
          impact: 'The chart has no default values.',
          suggestedAction: 'Create values.yaml for the Helm chart.',
        });
      }
      const chartContent = readFile(ctx, 'Chart.yaml');
      if (chartContent && !/apiVersion\s*:/i.test(chartContent)) {
        issues.push({
          id: 'helm-no-apiversion',
          title: 'Helm Chart.yaml missing apiVersion',
          category: 'deployment',
          severity: 'warning',
          description: 'Chart.yaml does not declare an apiVersion.',
          reason: 'apiVersion is required for Helm v3 (v2).',
          recommendation: 'Add "apiVersion: v2" to Chart.yaml.',
          affectedFile: 'Chart.yaml',
          detected: 'no apiVersion',
          expected: 'apiVersion: v2',
          impact: 'Helm may reject the chart.',
          suggestedAction: 'Add apiVersion to Chart.yaml.',
        });
      }
      return issues;
    },
  },
  {
    id: 'kustomize-present',
    category: 'deployment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasKustomization = ctx.files.some(
        (f) => !f.isDirectory && /kustomization\.ya?ml$/i.test(f.path)
      );
      if (!hasKustomization) return issues;
      const kustomizeFile = ctx.files.find(
        (f) => !f.isDirectory && /kustomization\.ya?ml$/i.test(f.path)
      );
      if (kustomizeFile?.content && !/resources\s*:/i.test(kustomizeFile.content)) {
        issues.push({
          id: 'kustomize-no-resources',
          title: 'Kustomization missing resources field',
          category: 'deployment',
          severity: 'warning',
          description: 'kustomization.yaml does not declare a resources section.',
          reason: 'resources lists the manifests to include.',
          recommendation: 'Add a "resources:" section with the base manifests.',
          affectedFile: kustomizeFile.path,
          detected: 'no resources',
          expected: 'resources section',
          impact: 'Kustomize does not know what to build.',
          suggestedAction: 'Add resources to kustomization.yaml.',
        });
      }
      return issues;
    },
  },
  {
    id: 'k8s-namespace-specified',
    category: 'deployment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const deploymentFile = ctx.files.find(
        (f) => !f.isDirectory && /deployment\.ya?ml$/i.test(f.path)
      );
      if (!deploymentFile || !deploymentFile.content) return issues;
      if (/kind:\s*Deployment/i.test(deploymentFile.content) && !/namespace\s*:/i.test(deploymentFile.content)) {
        issues.push({
          id: 'k8s-no-namespace',
          title: 'Kubernetes Deployment missing namespace',
          category: 'deployment',
          severity: 'info',
          description: 'The Deployment does not specify a namespace.',
          reason: 'Without a namespace, resources deploy to "default".',
          recommendation: 'Add a namespace to the Deployment metadata.',
          affectedFile: deploymentFile.path,
          detected: 'no namespace',
          expected: 'namespace specified',
          impact: 'Resources may clutter the default namespace.',
          suggestedAction: 'Add a namespace to the Deployment.',
        });
      }
      return issues;
    },
  },
  {
    id: 'k8s-image-pull-policy',
    category: 'deployment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const deploymentFile = ctx.files.find(
        (f) => !f.isDirectory && /deployment\.ya?ml$/i.test(f.path)
      );
      if (!deploymentFile || !deploymentFile.content) return issues;
      if (/kind:\s*Deployment/i.test(deploymentFile.content) && !/imagePullPolicy\s*:/i.test(deploymentFile.content)) {
        issues.push({
          id: 'k8s-no-image-pull-policy',
          title: 'Kubernetes Deployment missing imagePullPolicy',
          category: 'deployment',
          severity: 'info',
          description: 'The Deployment does not specify an imagePullPolicy.',
          reason: 'Without it, the policy defaults to IfNotPresent, which may use stale images.',
          recommendation: 'Add "imagePullPolicy: Always" for production.',
          affectedFile: deploymentFile.path,
          detected: 'not specified',
          expected: 'imagePullPolicy',
          impact: 'May use cached images instead of latest.',
          suggestedAction: 'Add imagePullPolicy to the container spec.',
        });
      }
      return issues;
    },
  },
];
