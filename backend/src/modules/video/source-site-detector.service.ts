import { Injectable } from '@nestjs/common';

export type SourceSite = 'generic' | 'instagram' | 'x' | 'youtube';

@Injectable()
export class SourceSiteDetectorService {
  detect(url: string): SourceSite {
    const hostname = this.getHostname(url);
    if (!hostname) {
      return 'generic';
    }

    if (this.matchesDomain(hostname, 'instagram.com')) {
      return 'instagram';
    }

    if (
      this.matchesDomain(hostname, 'x.com') ||
      this.matchesDomain(hostname, 'twitter.com')
    ) {
      return 'x';
    }

    if (
      this.matchesDomain(hostname, 'youtube.com') ||
      this.matchesDomain(hostname, 'youtu.be')
    ) {
      return 'youtube';
    }

    return 'generic';
  }

  private getHostname(url: string): string | null {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  private matchesDomain(hostname: string, domain: string): boolean {
    return hostname === domain || hostname.endsWith(`.${domain}`);
  }
}
