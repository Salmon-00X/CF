/* =========================================================================
 * FilesPanel — files imported into the selected month, with delete.
 * Delete cascades to the file's readings (backend), then reload() refreshes
 * the whole app so the dashboard reflects the removal.
 * ========================================================================= */
import { useEffect, useState } from 'react';
import { api, type FileRow } from '../../lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';

interface Props {
  monthKey: string;
  files: string[];
  reload: () => Promise<unknown>;
}

export default function FilesPanel({ monthKey, reload }: Props) {
  const [rows, setRows] = useState<FileRow[]>([]);

  useEffect(() => {
    api
      .files(monthKey)
      .then(setRows)
      .catch((e) => toast.error('Could not load files: ' + e.message));
  }, [monthKey]);

  async function del(f: FileRow) {
    try {
      await api.deleteFile(f.id);
      toast.success(`Deleted ${f.filename} (${f.row_count} readings).`);
      await reload();
      setRows((r) => r.filter((x) => x.id !== f.id));
    } catch (e: any) {
      toast.error('Delete failed: ' + e.message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Imported files</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files for this month.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead>Imported</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.filename}</TableCell>
                  <TableCell>{f.plant || '—'}</TableCell>
                  <TableCell>{f.model || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.row_count}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(f.imported_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this file?</AlertDialogTitle>
                          <AlertDialogDescription>
                            “{f.filename}” and its {f.row_count} readings will be removed permanently.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del(f)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
