import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          // Remove non-boolean status fields from existing payloads
          if ('status' in data && typeof (data as any).status !== 'boolean') {
            const { status, ...rest } = data as any;
            return { status: true, ...rest };
          }
          // Force status: true for all successful responses
          return { status: true, ...data };
        }
        // For primitives/arrays, wrap with status: true
        return { status: true, data };
      })
    );
  }
}
