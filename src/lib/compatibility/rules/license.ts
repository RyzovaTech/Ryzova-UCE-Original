import type { CompatibilityRule } from '../types';
import type { Issue } from '../../analyzer/types';
import { readFile } from './shared';

const LICENSE_COMPATIBILITY: Record<string, string[]> = {
  'MIT': ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MPL-2.0', 'Unlicense', 'CC0-1.0'],
  'Apache-2.0': ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MPL-2.0', 'Unlicense'],
  'BSD-2-Clause': ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Unlicense'],
  'BSD-3-Clause': ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Unlicense'],
  'ISC': ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Unlicense'],
  'GPL-3.0': ['GPL-3.0', 'GPL-2.0', 'LGPL-3.0', 'AGPL-3.0'],
  'GPL-2.0': ['GPL-2.0', 'GPL-3.0', 'LGPL-2.1', 'LGPL-3.0'],
  'LGPL-3.0': ['LGPL-3.0', 'GPL-3.0'],
  'AGPL-3.0': ['AGPL-3.0', 'GPL-3.0'],
  'MPL-2.0': ['MPL-2.0', 'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'],
};

const COPyleft_LICENSES = ['GPL-2.0', 'GPL-3.0', 'LGPL-2.1', 'LGPL-3.0', 'AGPL-3.0'];

function detectLicenseFromContent(content: string): string | null {
  if (/MIT License/i.test(content)) return 'MIT';
  if (/Apache License.*2\.0/i.test(content)) return 'Apache-2.0';
  if (/BSD 2-Clause/i.test(content)) return 'BSD-2-Clause';
  if (/BSD 3-Clause/i.test(content)) return 'BSD-3-Clause';
  if (/GNU GENERAL PUBLIC LICENSE.*version 3/i.test(content)) return 'GPL-3.0';
  if (/GNU GENERAL PUBLIC LICENSE.*version 2/i.test(content)) return 'GPL-2.0';
  if (/GNU LESSER GENERAL PUBLIC LICENSE/i.test(content)) return 'LGPL-3.0';
  if (/GNU AFFERO GENERAL PUBLIC LICENSE/i.test(content)) return 'AGPL-3.0';
  if (/Mozilla Public License.*2\.0/i.test(content)) return 'MPL-2.0';
  if (/ISC License/i.test(content)) return 'ISC';
  return null;
}

export const licenseRules: CompatibilityRule[] = [
  {
    id: 'license-file-detected',
    category: 'security',
    run: (ctx) => {
      const issues: Issue[] = [];
      const licenseFile = ctx.files.find(
        (f) => !f.isDirectory && (f.path === 'LICENSE' || f.path.endsWith('/LICENSE') ||
          f.path === 'LICENSE.md' || f.path.endsWith('/LICENSE.md') ||
          f.path === 'LICENSE.txt' || f.path.endsWith('/LICENSE.txt'))
      );
      if (!licenseFile || !licenseFile.content) return issues;
      const detected = detectLicenseFromContent(licenseFile.content);
      if (!detected) {
        issues.push({
          id: 'license-unrecognized',
          title: 'LICENSE file content could not be identified',
          category: 'security',
          severity: 'info',
          description: 'A LICENSE file exists but its license type could not be determined.',
          reason: 'Unrecognized licenses make compliance checks difficult.',
          recommendation: 'Use a standard license header (e.g. MIT, Apache-2.0).',
          affectedFile: licenseFile.path,
          detected: 'unrecognized',
          expected: 'standard SPDX license',
          impact: 'Legal compliance is unclear.',
          suggestedAction: 'Use a standard license identifier.',
        });
      }
      return issues;
    },
  },
  {
    id: 'package-json-license-vs-file',
    category: 'security',
    run: (ctx) => {
      const issues: Issue[] = [];
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      let pkgLicense: string | null = null;
      try {
        const p = JSON.parse(pkg);
        pkgLicense = typeof p.license === 'string' ? p.license : null;
      } catch {
        // ignore
      }
      const licenseFile = ctx.files.find(
        (f) => !f.isDirectory && (f.path === 'LICENSE' || f.path.endsWith('/LICENSE') ||
          f.path === 'LICENSE.md' || f.path.endsWith('/LICENSE.md'))
      );
      if (!pkgLicense || !licenseFile?.content) return issues;
      const fileLicense = detectLicenseFromContent(licenseFile.content);
      if (fileLicense && pkgLicense !== fileLicense && !pkgLicense.includes(fileLicense)) {
        issues.push({
          id: 'license-mismatch',
          title: 'package.json license does not match LICENSE file',
          category: 'security',
          severity: 'warning',
          description: `package.json declares "${pkgLicense}" but LICENSE file appears to be "${fileLicense}".`,
          reason: 'Inconsistent license declarations create legal ambiguity.',
          recommendation: 'Align the license in package.json and the LICENSE file.',
          affectedFile: 'package.json',
          detected: `${pkgLicense} vs ${fileLicense}`,
          expected: 'consistent license',
          impact: 'Legal compliance is unclear.',
          suggestedAction: 'Make both license declarations consistent.',
        });
      }
      return issues;
    },
  },
  {
    id: 'copyleft-license-in-deps',
    category: 'security',
    run: (ctx) => {
      const issues: Issue[] = [];
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      const licenseFile = ctx.files.find(
        (f) => !f.isDirectory && (f.path === 'LICENSE' || f.path.endsWith('/LICENSE'))
      );
      const projectLicense = licenseFile?.content ? detectLicenseFromContent(licenseFile.content) : null;
      if (!projectLicense) return issues;
      const compatible = LICENSE_COMPATIBILITY[projectLicense];
      if (!compatible) return issues;
      try {
        const p = JSON.parse(pkg);
        const allDeps = { ...(p.dependencies ?? {}), ...(p.devDependencies ?? {}) } as Record<string, string>;
        for (const [name, range] of Object.entries(allDeps)) {
          const m = range.match(/(GPL-[23]\.0|LGPL-[23]\.0|AGPL-3\.0)/i);
          if (m) {
            const depLicense = m[1].toUpperCase();
            if (!compatible.includes(depLicense)) {
              issues.push({
                id: `license-conflict-${name}`,
                title: `License conflict: ${name} (${depLicense}) with project (${projectLicense})`,
                category: 'security',
                severity: 'warning',
                description: `Dependency ${name} uses ${depLicense} which may conflict with the project's ${projectLicense} license.`,
                reason: 'Copyleft licenses can impose restrictions on the project.',
                recommendation: `Verify ${name}'s license is compatible with ${projectLicense}.`,
                affectedFile: 'package.json',
                detected: `${depLicense} dependency`,
                expected: `compatible with ${projectLicense}`,
                impact: 'Legal obligations may extend to the entire project.',
                suggestedAction: 'Replace the dependency or verify compatibility.',
              });
            }
          }
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'license-not-declared-in-package-json',
    category: 'security',
    run: (ctx) => {
      const issues: Issue[] = [];
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      try {
        const p = JSON.parse(pkg);
        if (!p.license) {
          const hasLicenseFile = ctx.detectedFiles.some(
            (f) => f.path === 'LICENSE' || f.path.endsWith('/LICENSE') ||
              f.path === 'LICENSE.md' || f.path.endsWith('/LICENSE.md')
          );
          if (!hasLicenseFile) {
            issues.push({
              id: 'pkg-license-not-declared',
              title: 'No license declared in package.json or LICENSE file',
              category: 'security',
              severity: 'info',
              description: 'package.json has no license field and no LICENSE file was found.',
              reason: 'Without a license, the project defaults to "All Rights Reserved".',
              recommendation: 'Add a "license" field and a LICENSE file.',
              affectedFile: 'package.json',
              detected: 'no license',
              expected: 'SPDX license identifier',
              impact: 'Others cannot legally use or contribute to the project.',
              suggestedAction: 'Add a license to package.json.',
            });
          }
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'copyleft-deployment-warning',
    category: 'security',
    run: (ctx) => {
      const issues: Issue[] = [];
      const licenseFile = ctx.files.find(
        (f) => !f.isDirectory && (f.path === 'LICENSE' || f.path.endsWith('/LICENSE'))
      );
      if (!licenseFile?.content) return issues;
      const projectLicense = detectLicenseFromContent(licenseFile.content);
      if (!projectLicense) return issues;
      if (COPyleft_LICENSES.includes(projectLicense)) {
        const hasDocker = ctx.detectedFiles.some((f) => f.path.endsWith('Dockerfile'));
        if (hasDocker) {
          issues.push({
            id: 'copyleft-with-docker-deployment',
            title: `${projectLicense} license with Docker deployment`,
            category: 'security',
            severity: 'info',
            description: `The project uses ${projectLicense} and includes a Dockerfile.`,
            reason: 'Copyleft licenses may require source disclosure for distributed images.',
            recommendation: 'Ensure source code is available with any distributed images.',
            affectedFile: 'LICENSE',
            detected: projectLicense,
            expected: 'source disclosure compliance',
            impact: 'Legal obligations for source distribution.',
            suggestedAction: 'Verify source disclosure requirements are met.',
          });
        }
      }
      return issues;
    },
  },
];
